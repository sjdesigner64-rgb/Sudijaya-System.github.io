import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { notifyUser, notifyUsers, getActiveUsersByRole } from '../lib/notify'

const DAY_MS = 24 * 60 * 60 * 1000
const ALERT_DAYS_BEFORE = [30, 7, 1]

// sendDailyReminder — 09:00, 13:00, 17:00 WIB (Asia/Jakarta = UTC+7, cron runs in server local time/UTC)
const sendDailyReminder = async () => {
  const pendingTasks = await prisma.task.findMany({ where: { status: { not: 'done' } } })
  const pendingByUser = new Map<string, number>()
  for (const task of pendingTasks) {
    pendingByUser.set(task.assignedTo, (pendingByUser.get(task.assignedTo) ?? 0) + 1)
  }
  for (const [userId, count] of pendingByUser.entries()) {
    await notifyUser({
      recipientId: userId,
      type: 'reminder',
      title: 'Pengingat Tugas',
      message: `Anda memiliki ${count} tugas yang belum selesai. Segera tindak lanjuti.`,
      relatedId: userId,
      relatedCollection: 'tasks',
    })
  }
}

// sendWarrantyAlert — daily 08:00, checks H-30/H-7/H-1
const sendWarrantyAlert = async () => {
  const records = await prisma.afterSales.findMany()
  const adminUsers = await getActiveUsersByRole(['admin', 'super_admin'])
  if (adminUsers.length === 0) return
  const now = Date.now()

  for (const record of records) {
    const daysLeft = Math.round((record.warrantyEndDate.getTime() - now) / DAY_MS)
    if (!ALERT_DAYS_BEFORE.includes(daysLeft)) continue

    await notifyUsers(adminUsers.map((u) => u.id), {
      type: 'warranty',
      title: 'Garansi Akan Berakhir',
      message: `Masa garansi project akan berakhir dalam ${daysLeft} hari (${record.warrantyEndDate.toLocaleDateString('id-ID')}).`,
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
