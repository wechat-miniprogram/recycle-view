//获取应用实例
const app = getApp()
let data = require('./data.js')
let j = 1
data = data.response.data
const systemInfo = wx.getSystemInfoSync()

// 提交wx.createRecycleContext能力
const createRecycleContext = require('../../components/index.js')

Page({

  data: {
  },
  onLoad: function () {
  },
  onUnload: function () {
    this.ctx.destroy()
    this.ctx = null
  },
  onReady: function () {
    let newData = []
    data.forEach((item, i) => {

      if (item.goods) {
        newData = newData.concat(item.goods)
      }
    })
    this.showView()
  },
  genData: function() {
    let newData = []
    data.forEach((item, i) => {
      if (item.goods) {
        newData = newData.concat(item.goods)
      }
      // 构造270份数据
      var item = item.goods[0]
      for (var i = 0; i < 20; i++) {
        var newItem = Object.assign({}, item)
        newData.push(newItem)
      }
    })
    const newList = []
    let k = 0
    newData.forEach((item, i) => {
      item.idx = i
      if (k % 10 == 0) {
        item.azFirst = true
      }
      k++
      newList.push(item)
      item.id = item.id + (j++)
      item.image_url = item.image_url.replace('https', 'http')
      var newItem = Object.assign({}, item)
      if (k % 10 == 0) {
        newItem.azFirst = true
        // console.log('first item', newList.length)
      }
      k++
      newItem.id = newItem.id + '_1'
      newItem.image_url = newItem.image_url.replace('https', 'http')
      newList.push(newItem)
    })
    return newList
  },
  showView: function () {
    const newList = this.genData()
    // console.log('recycle data is', newList)
    // API的调用方式
    var ctx = createRecycleContext({
      id: 'recycleId',
      dataKey: 'recycleList',
      page: this,
      itemSize: function(item) {
        return {
          width: 301,
          height: item.azFirst ? 130 : 120
        }
      },
      forKey: 'id'
    })
    console.log('len', newList.length)
    const st = Date.now()
    // ctx.splice(0, 0, newList, function() {
    //   // 新增加的数据渲染完毕之后, 触发的回调
    //   console.log('【render】use time', Date.now() - st)
    // })
    ctx.splice(newList, () => {
      // 新增加的数据渲染完毕之后, 触发的回调
      console.log('【render】deleteList use time', Date.now() - st)
      // this.setData({
      //   scrollTop: 1000
      // })
    })
    this.ctx = ctx
  },
  itemSizeFunc: function (item, idx) {
    return {
      width: 162,
      height: 182
    }
  },
  scrollToLower: function(e) {
    // 延迟1s，模拟网络请求
    if (this.isScrollToLower) return
    console.log('【【【【trigger scrollToLower')
    this.isScrollToLower = true
    setTimeout(() => {
      console.log('【【【【exec scrollToLower')
      const newList = this.genData()
      this.ctx.append(newList, () => {
        this.isScrollToLower = false
      })
    }, 1000)
  },
  scrollTo2000: function (e) {
    this.setData({
      scrollTop: 5000
    })
  },
  scrollTo0: function () {
    this.setData({
      scrollTop: 0
    })
  },
  newEmptyPage: function() {
    wx.navigateTo({
      url: './empty/empty'
    })
  },
  scrollToid: function() {
    this.setData({
      index: 100
    })
  },
  getScrollTop: function() {
    console.log('getScrollTop', this.ctx.getScrollTop())
  }
})
