/**
 * recycle-view组件的api使用
 * 提供wx.createRecycleContext进行管理功能
 */
const RecycleContext = require('./utils/recycle-context.js')

/**
 * @params options参数是object对象，展开的结构如下
      id: recycle-view的id
      dataKey: recycle-item的wx:for绑定的数据变量
      page: recycle-view所在的页面或组件的实例
      itemSize: 函数或者是Object对象，生成每个recycle-item的宽和高
 * @return RecycleContext对象
 */
module.exports = function (options) {
  return new RecycleContext(options)
}
