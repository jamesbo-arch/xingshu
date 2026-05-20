import * as mock from '../data/mock.js'

// Mock API — returns mock data with a simulated delay
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms))

export async function getKpi() { await delay(); return mock.adminKpi }
export async function getActivity() { await delay(); return mock.adminActivity }
export async function getTrend() { await delay(); return mock.adminTrend }

export async function getUsers(params = {}) {
  await delay()
  let list = [...mock.adminUsers]
  if (params.identity) list = list.filter(u => u.identity === params.identity)
  if (params.keyword) list = list.filter(u => u.nickname.includes(params.keyword) || u.phone.includes(params.keyword))
  return { list, total: list.length }
}

export async function getUserDetail(id) {
  await delay()
  const user = mock.adminUsers.find(u => u.id === id)
  const diaries = mock.adminDiaries.filter(d => d.authorId === id)
  return { user, diaries }
}

export async function getDiaries(params = {}) {
  await delay()
  let list = [...mock.adminDiaries]
  if (params.keyword) list = list.filter(d => d.title.includes(params.keyword) || d.content.includes(params.keyword))
  if (params.permission) list = list.filter(d => d.permission === params.permission)
  if (params.tag) list = list.filter(d => d.tags.includes(params.tag))
  return { list, total: list.length }
}

export async function getDiaryDetail(id) {
  await delay()
  const diary = mock.adminDiaries.find(d => d.id === id)
  const comments = mock.adminComments.filter(c => c.diaryId === id)
  return { diary, comments }
}

export async function deleteDiary(id) { await delay(); return true }
export async function deleteComment(id) { await delay(); return true }

export async function getComments(params = {}) {
  await delay()
  let list = [...mock.adminComments]
  if (params.keyword) list = list.filter(c => c.content.includes(params.keyword))
  if (params.userId) list = list.filter(c => c.userId === params.userId)
  return { list, total: list.length }
}
