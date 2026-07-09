// 协议查看页：据 type 显示用户协议 / 隐私协议（正文占位，待填入正式文本）
const DOCS = {
  agreement: {
    title: '用户协议',
    body: '（此处填入《醒书日记用户协议》正文。）\n\n示例结构：\n一、服务说明\n二、账号与身份\n三、内容规范\n四、会员服务\n五、免责声明\n六、协议更新',
  },
  privacy: {
    title: '隐私协议',
    body: '（此处填入《醒书日记隐私政策》正文。）\n\n示例结构：\n一、我们收集的信息（微信 openid/unionid、你填写的昵称/姓名/手机号等）\n二、信息的使用\n三、信息的存储与保护\n四、信息的对外提供\n五、你的权利（查询/更正/删除）\n六、政策更新与联系方式',
  },
}

Page({
  data: { title: '', body: '' },
  onLoad(options) {
    const doc = DOCS[options.type] || DOCS.agreement
    wx.setNavigationBarTitle({ title: doc.title })
    this.setData({ title: doc.title, body: doc.body })
  },
})
