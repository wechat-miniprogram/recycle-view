var recycleData = require('./recycle-data.js')
const recycleViewportChangeFunc = require('./viewport-change-func')
const transformRpx = require('./transformRpx.js')

const RECT_SIZE = 200

function RecycleContext({id, dataKey, page, itemSize, forKey}) {
  if (!id || !dataKey || !page || !itemSize) {
    throw `parameter id, dataKey, page, itemSize is required`
  }
  if (typeof itemSize !== 'function' && typeof itemSize !== 'object') {
    throw 'parameter itemSize must be function or object with key width and height'
  }
  if (typeof itemSize === 'object' && (!itemSize.width || !itemSize.height)) {
    throw 'parameter itemSize must be function or object with key width and height'
  }
  this.id = id
  this.dataKey = dataKey
  this.forKey = forKey
  this.page = page
  page._recycleViewportChange = recycleViewportChangeFunc
  this.comp = page.selectComponent('#' + id)
  this.itemSize = itemSize
  if (!this.comp) {
    throw `<recycle-view> with id ${id} not found`
  }
  this.comp.context = this
  this.comp.setPage(page)
}
RecycleContext.prototype.checkComp = function() {
  if (!this.comp) {
    throw `the recycle-view correspond to this context is detached, pls create another RecycleContext`
  }
}
RecycleContext.prototype.appendList = function(list, cb) {
  this.checkComp()
  const id = this.id
  const dataKey = this.dataKey
  if (!recycleData[id]) {
    recycleData[id] = {
      key: dataKey,
      id: id,
      list: list,
      sizeMap: {},
      sizeArray: [],
      forKey: this.forKey
    }
  } else {
    recycleData[id].dataKey = dataKey
    recycleData[id].list = recycleData[id].list.concat(list)
  }
  this._forceRerender(id, cb)
  return this
}
RecycleContext.prototype._forceRerender = function(id, cb) {
  const page = this.page
  const sizeData = this._recalculateSize(recycleData[id].list)
  recycleData[id].sizeMap = sizeData.map
  // console.log('size is', sizeData.map, 'totalHeight', sizeData.totalHeight)
  // console.log('sizeArray', sizeData.array)
  recycleData[id].sizeArray = sizeData.array
  // 触发强制渲染
  this.comp.forceUpdate(cb)
}
// 当before和after这2个slot发生变化的时候调用一下此接口
RecycleContext.prototype._recalculateSize = function (list) {
  // 遍历所有的数据
  // 应该最多就千量级的, 遍历没有问题
  const sizeMap = {}
  const func = this.itemSize
  let funcExist = typeof func === 'function'
  const comp = this.comp
  const compData = comp.data
  let itemSize = {}
  let offsetLeft = 0
  let offsetTop = 0
  let line = 0
  let column = 0
  let totalHeight = 0
  let sizeArray = []
  // 把整个页面拆分成200*200的很多个方格, 判断每个数据落在哪个方格上
  for (let i = 0; i < list.length; i++) {
    // 获取到每一项的宽和高
    if (funcExist) {
      // 必须保证返回的每一行的高度一样
      itemSize = func&&func.call(this.page, list[i], i)
    } else {
      itemSize = {
        width: func.width,
        height: func.height
      }
    }
    sizeArray.push(itemSize)
    // 判断落到哪个方格上
    // 超过了宽度, 移动到下一行, 再根据高度判断是否需要移动到下一个方格
    if (offsetLeft + itemSize.width > compData.width) {
      offsetLeft = 0
      offsetTop += itemSize.height
      // 根据高度判断是否需要移动到下一个方格
      if (offsetTop >= RECT_SIZE * (line+1)) {
        line += parseInt((offsetTop - RECT_SIZE*line)/RECT_SIZE)
      }
      column = 0
    } else {
      if (offsetLeft >= RECT_SIZE * (column+1)) {
        column++
      }
    }
    itemSize.beforeHeight = offsetTop
    const key = `${line}.${column}`
    sizeMap[key] || (sizeMap[key] = [])
    sizeMap[key].push(i)
    offsetLeft += itemSize.width
  }
  const obj = {
    array: sizeArray,
    map: sizeMap,
    totalHeight: offsetTop + itemSize.height
  }
  comp.setItemSize(obj)
  return obj
}
RecycleContext.prototype.deleteList = function(beginIndex, count, cb) {
  this.checkComp()
  const page = this.page
  const id = this.id
  if (!recycleData[id]) {
    return
  }
  recycleData[id].list.splice(beginIndex, count)
  this._forceRerender(id, cb)
  return this
}
RecycleContext.prototype.updateList = function(beginIndex, list, cb) {
  this.checkComp()
  const page = this.page
  const id = this.id
  if (!recycleData[id]) {
    return
  }
  const len = recycleData[id].list.length
  for (let i = 0; i < list.length && beginIndex < len; i++) {
    recycleData[id].list[beginIndex++] = list[beginIndex++]
  }
  this._forceRerender(id, cb)
  return this
}
RecycleContext.prototype.splice = function(begin, deleteCount, appendList, cb) {
  this.checkComp()
  const id = this.id
  const dataKey = this.dataKey
  // begin是数组
  if (typeof begin === 'object' && begin.length) {
    cb = deleteCount
    appendList = begin
  }
  if (typeof appendList == 'function') {
    cb = appendList
    appendList = []
  }
  if (!recycleData[id]) {
    recycleData[id] = {
      key: dataKey,
      id: id,
      list: appendList||[],
      sizeMap: {},
      sizeArray: []
    }
  } else {
    recycleData[id].dataKey = dataKey
    const list = recycleData[id].list
    if (appendList && appendList.length) {
      list.splice(begin, deleteCount, appendList)
    } else {
      list.splice(begin, deleteCount)
    }
    // 直接使用Array.splice即可
    /*
    begin < 0 && (begin = 0)
    deleteCount < 0 && (deleteCount = 0)
    begin + deleteCount > list.length && (deleteCount = list.length - begin)
    if (!appendList || !appendList.length) {
      if (deleteCount == 0) return
      if (begin + deleteCount >= list.length) {
        list.length = begin
      } else {
        for (let i = 0; i < deleteCount; i++) {
          list[begin + i] = list[begin + deleteCount + i]
        }
        list.length = list.length - deleteCount
      }
    } else {
      const appendCount = appendList.length
      if (deleteCount >= appendCount) {
        for (let i = 0; i < appendCount; i++) {
          list[begin + i] = appendList[i]
        }
      } else {
        for (let i = 0; i < appendCount; i++) {
          if (i >= deleteCount && i < list.length) {
            list[begin + appendCount - deleteCount + i] = list[begin + i]
          }
          list[begin + i] = appendList[i]
        }
      }
      list.length = begin + appendList.length
    }
    */
  }
  this._forceRerender(id, cb)
  return this
}

RecycleContext.prototype.append = RecycleContext.prototype.appendList

RecycleContext.prototype.destroy = function() {
  this.page = null
  this.comp = null
  if (recycleData[this.id]) {
    delete recycleData[this.id]
  }
  return this
}
// 重新更新下页面的数据
RecycleContext.prototype.forceUpdate = function(cb, reinitSlot) {
  this.checkComp()
  if (this.reinitSlot) {
    this.comp.reRender(() => {
      this._forceRerender(this.id, cb)
    })
  } else {
    this._forceRerender(this.id, cb)
  }
  return this
}
RecycleContext.prototype.getBoundingClientRect = function(index) {
  this.checkComp()
  if (!recycleData[this.id]) {
    return null
  }
  const sizeArray = recycleData[this.id].sizeArray
  if (!sizeArray || !sizeArray.length) {
    return null
  }
  if (typeof index === 'undefined') {
    const list = []
    for (let i = 0; i < sizeArray.length; i++) {
      list.push({
        left: 0,
        top: sizeArray[i].beforeHeight,
        width: sizeArray[i].width,
        height: sizeArray[i].height
      })
    }
    return list
  }
  index = parseInt(index)
  if (index >= sizeArray.length || index < 0) return null
  return {
    left: 0,
    top: sizeArray[index].beforeHeight,
    width: sizeArray[index].width,
    height: sizeArray[index].height
  }
}
RecycleContext.prototype.getScrollTop = function() {
  this.checkComp()
  return this.comp.currentScrollTop || 0
}
// 将px转化为rpx
RecycleContext.prototype.transformRpx = RecycleContext.transformRpx = function(str, addPxSuffix) {
  return transformRpx.transformRpx(str, addPxSuffix)
}
module.exports = RecycleContext