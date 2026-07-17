const { call } = require('./request')

module.exports = {
  toggleLike(targetId, targetType) {
    return call('toggleLike', { targetId, targetType })
  },
  toggleFav(storyId) {
    return call('toggleFavorite', { storyId })
  },
  createComment(storyId, content, parentId) {
    return call('createComment', { storyId, content, parentId })
  },
  getComments(storyId, page = 1) {
    return call('getComments', { storyId, page }, { retry: 1 })
  },
  deleteComment(commentId) {
    return call('deleteComment', { commentId })
  },
  recordShare(storyId) {
    return call('recordShare', { storyId }, { showError: false })
  },
}
