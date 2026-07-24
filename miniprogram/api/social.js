const { call } = require('./request')

module.exports = {
  toggleLike(targetId, targetType) {
    return call('toggleLike', { targetId, targetType })
  },
  toggleFav(storyId) {
    return call('toggleFavorite', { storyId })
  },
  createComment(storyId, content, parentId) {
    return call('createStoryComment', { storyId, content, parentId })
  },
  getComments(storyId, page = 1) {
    return call('getStoryComments', { storyId, page }, { retry: 1 })
  },
  deleteComment(commentId) {
    return call('deleteStoryComment', { commentId })
  },
  recordShare(storyId) {
    return call('recordShare', { storyId }, { showError: false })
  },
}
