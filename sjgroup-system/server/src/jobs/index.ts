import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { notifyUser, notifyUsers, getActiveUsersByRole } from '../lib/notify'

const DAY_MS = 24 * 60 * 60 * 1000
const ALERT_DAYS_BEFORE = [30, 7, 1]

// sendDailyReminder — 09:00, 13:00, 17:00 WIB (Asia/Jakarta = UTC+7, cron runs in server local time/UTC)
const sendDailyReminder = async () => {
  const pendingTasks = await prisma.task.findMany({ where: { status: { not: 'done' } }, orderBy: { dueDate: 'asc' } })
  const titlesByUser = new Map<string, string[]>()
  for (const task of pendingTasks) {
    const list = titlesByUser.get(task.assignedTo) ?? []
    list.push(task.title)
    titlesByUser.set(task.assignedTo, list)
  }
  for (const [userId, titles] of titlesByUser.entries()) {
    const preview = titles.slice(0, 3).join(', ')
    const sisa = titles.length > 3 ? `, dan ${titles.length - 3} tugas lainnya` : ''
    await notifyUser({
      recipientId: userId,
      type: 'reminder',
      title: 'Pengingat Tugas',
      message: `Anda memiliki ${titles.length} tugas yang belum selesai: ${preview}${sisa}. Segera tindak lanjuti.`,
      relatedId: userId,
      relatedCollection: 'tasks',
    })
  }
}

// sendWarrantyAlert — daily 08:00, alert tiket after-sales yang belum selesai dan mendekati/lewat handlingDeadline
const sendWarrantyAlert = async () => {
  const records = await prisma.afterSales.findMany({
    where: { ticketStatus: { notIn: ['selesai', 'cancel'] }, handlingDeadline: { not: null } },
  })
  const adminUsers = await getActiveUsersByRole(['admin', 'super_admin'])
  const now = Date.now()

  for (const record of records) {
    if (!record.handlingDeadline) continue
    const daysLeft = Math.round((record.handlingDeadline.getTime() - now) / DAY_MS)
    if (!ALERT_DAYS_BEFORE.includes(daysLeft) && daysLeft >= 0) continue
    if (daysLeft < -1) continue // jangan spam tiket yang sudah lama lewat deadline

    const recipientIds = [...adminUsers.map((u) => u.id), record.picAftersales, record.technicianAssigned].filter(
      (v): v is string => Boolean(v)
    )
    const message = daysLeft >= 0
      ? `Tiket after-sales "${record.machineName}" (${record.customerName ?? '-'}) jatuh tempo dalam ${daysLeft} hari.`
      : `Tiket after-sales "${record.machineName}" (${record.customerName ?? '-'}) sudah melewati deadline penanganan.`

    await notifyUsers([...new Set(recipientIds)], {
      type: 'warranty',
      title: 'Deadline Penanganan Tiket',
      message,
      relatedId: record.id,
      relatedCollection: 'after_sales',
    })
  }
}

// sendProductionAlert — daily check, H-7 before overallDeadline
const sendProductionAlert = async () => {
  const ganttDocs = await prisma.productionGantt.findMany({
    where: { status: 'active', h7AlertSent: false },
  })
  const adminUsers = await getActiveUsersByRole(['admin', 'super_admin'])

  for (const doc of ganttDocs) {
    const daysLeft = Math.round((doc.overallDeadline.getTime() - Date.now()) / DAY_MS)
    if (daysLeft > 7) continue

    const recipientIds = [...adminUsers.map((u) => u.id), doc.salesPic].filter(Boolean)
    await notifyUsers(recipientIds, {
      type: 'reminder',
      title: 'H-7 Deadline Produksi',
      message: `Project "${doc.projectName}" akan mencapai deadline produksi pada ${doc.overallDeadline.toLocaleDateString('id-ID')}.`,
      relatedId: doc.id,
      relatedCollection: 'production_gantt',
    })

    await prisma.productionGantt.update({ where: { id: doc.id }, data: { h7AlertSent: true } })
  }
}

// archiveClosedLeads — weekly, Sunday 00:00
const archiveClosedLeads = async () => {
  const leads = await prisma.lead.findMany({
    where: { status: { in: ['closed_won', 'closed_lost'] } },
  })
  for (const lead of leads) {
    await prisma.leadArchive.create({ data: { id: lead.id, data: lead as never } })
    await prisma.lead.delete({ where: { id: lead.id } })
  }
}

export const startJobs = () => {
  cron.schedule('0 9,13,17 * * *', sendDailyReminder, { timezone: 'Asia/Jakarta' })
  cron.schedule('0 8 * * *', sendWarrantyAlert, { timezone: 'Asia/Jakarta' })
  cron.schedule('0 7 * * *', sendProductionAlert, { timezone: 'Asia/Jakarta' })
  cron.schedule('0 0 * * 0', archiveClosedLeads, { timezone: 'Asia/Jakarta' })
  console.log('Cron jobs started: sendDailyReminder, sendWarrantyAlert, sendProductionAlert, archiveClosedLeads')
}
