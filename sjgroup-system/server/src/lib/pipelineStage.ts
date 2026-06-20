import { prisma } from './prisma'
import { emitChange } from './socketBus'

export const STAGE_ORDER = [
  'leads',
  'dp_layout',
  'meeting_fabrikasi',
  'fabrikasi_build',
  'pelunasan',
  'pengiriman',
  'instalasi',
] as const

export type PipelineStage = (typeof STAGE_ORDER)[number]

/** Advance a project's pipelineStage to `target` only if it's not already further along. */
export const advanceProjectStage = async (projectId: string, target: PipelineStage) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return

  const currentIdx = STAGE_ORDER.indexOf(project.pipelineStage as PipelineStage)
  const targetIdx = STAGE_ORDER.indexOf(target)
  if (targetIdx <= currentIdx) return

  await prisma.project.update({ where: { id: projectId }, data: { pipelineStage: target } })
  emitChange('projects')
}
