const recycleData = require('./recycle-data.js')

module.exports = function _recycleViewportChange(e, cb) {
  const detail = e.detail
  // console.log('data change transfer use time', Date.now() - e.detail.timeStamp)
  var newList = []
  var item = recycleData[detail.id]
  const forKey = item.forKey
  var dataList = item.list
  var pos = detail.data
  var beginIndex = pos.beginIndex
  var endIndex = pos.endIndex
  item.pos = pos
  // 加ignoreBeginIndex和ignoreEndIndex
  let i = -1
  // 加默认数据看下是否有效果
  if (pos.direction === -1 && pos.defaultBeginIndex && pos.defaultEndIndex &&
      pos.defaultBeginIndex !== -1 && pos.defaultEndIndex !== -1) {
    for (i = pos.defaultBeginIndex; i <= pos.defaultEndIndex && i < dataList.length; i++) {
      const defaultObj = {__default: 1}
      item.forKey && (defaultObj[item.forKey] = dataList[i][item.forKey])
      newList.push(defaultObj)
    }
  }
  for (i = beginIndex; i < dataList.length && i <= endIndex; i++) {
    if (i >= pos.ignoreBeginIndex && i <= pos.ignoreEndIndex)
      continue
    newList.push(dataList[i])
  }
  if (pos.direction === 1 && pos.defaultBeginIndex && pos.defaultEndIndex &&
      pos.defaultBeginIndex !== -1 && pos.defaultEndIndex !== -1) {
    for (i = pos.defaultBeginIndex; i <= pos.defaultEndIndex && i < dataList.length; i++) {
      const defaultObj = {__default: 1}
      item.forKey && (defaultObj[item.forKey] = dataList[i][item.forKey])
      newList.push(defaultObj)
    }
  }
  var obj = {
    batchSetRecycleData: !this.data.batchSetRecycleData
  }
  const setDataStart = +new Date
  obj[item.key] = newList
  const comp = this.selectComponent('#' + detail.id)
  // comp.setList(item.key, newList)
  comp._setInnerBeforeAndAfterHeight({
    beforeHeight: pos.minTop,
    afterHeight: pos.afterHeight
  })
  // console.log('before set recycleData')
  this.setData(obj, function () {
    cb && cb()
    // console.log('set recycleData data use time', Date.now() - setDataStart, JSON.stringify(pos))
  })
}