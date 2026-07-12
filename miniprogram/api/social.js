const { call } = require('./request')

module.exports = {
  toggleLike(targetId, targetType) {
    return call('toggleLike', { targetId, targetType })
  },
  toggleFav(diaryId) {
    return call('toggleFavorite', { diaryId })
  },
  createComment(diaryId, content, parentId) {
    return call('createComment', { diaryId, content, parentId })
  },
  getComments(diaryId, page = 1) {
    return call('getComments', { diaryId, page }, { retry: 1 })
  },
  deleteComment(commentId) {
    return call('deleteComment', { commentId })
  },
  recordShare(diaryId) {
    return call('recordShare', { diaryId }, { showError: false })
  },
}
