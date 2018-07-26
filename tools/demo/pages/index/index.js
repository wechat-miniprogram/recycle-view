//获取应用实例
const app = getApp()
let data = require('./data.js')

data.response.data.splice(0, 10)
data = data.response.data
const systemInfo = wx.getSystemInfoSync()

// var RecycleViewBehavior = require('../../components/behavior.js')
// 提交wx.createRecycleContext能力
const createRecycleContext = require('../../components/index.js')

Page({
  // behaviors: [RecycleViewBehavior],

  data: {
    // recycleList: newData
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
      // console.log('goods', item.goods)

      if (item.goods) {
        newData = newData.concat(item.goods)
        // console.log('hello i', i, item)
      }
    })
    this.showView()
    // this.setData({
    //   recycleList: newData
    // })
  },
  showView: function () {
    let newData = []
    data.forEach((item, i) => {
      if (item.goods) {
        newData = newData.concat(item.goods)
        // console.log('hello i', i, item)
      }
    })
    const newList = []
    let j = 1
    newData.forEach((item, i) => {
      item.idx = i
      newList.push(item)
      item.id = item.id + (j++)
      item.image_url = item.image_url.replace('https', 'http')
      var newItem = Object.assign({}, item)
      newItem.id = newItem.id + '_1'
      newItem.image_url = newItem.image_url.replace('https', 'http')
      newList.push(newItem)
    })
    // Behavior的调用方式
    // const ctx = this.createRecycleContext({
    //   id: 'recycleId',
    //   dataKey: 'recycleList',
    //   itemSize: {
    //     width: 162,
    //     height: 182
    //   }
    // })
    // ctx.appendList(newList)
    // this.ctx = ctx
    console.log('data len is', JSON.stringify(newList).length)
    // API的调用方式
    setTimeout(() => {
      var ctx = createRecycleContext({
        id: 'recycleId', // wxml里面的recycle-view的id
        dataKey: 'recycleList', // wxml里面的recycle-item的wx:for的绑定数据字段
        page: this, // Page实例或者Component实例
        itemSize: { // recycle-item占的宽和高
          width: 162,
          height: 182
        }
      })
      console.log('len', newList.length)
      const st = Date.now()
      ctx.append(newList, function() {
        // 新增加的数据渲染完毕之后, 触发的回调
        console.log('render complete')
        // ctx.deleteList(50, 1000)
      })
      console.log('getBoundingClientRect', ctx.getBoundingClientRect(), ctx.getBoundingClientRect(100))
      this.ctx = ctx

      // 计算之后每次setData的耗时
      // const that = this
      // let kk = 0
      // let avg = 0
      // const intervalId = setInterval(function() {
      //   if (kk >= 10) {
      //     clearInterval(intervalId)
      //     console.log('【setData】avg use time', avg/kk)
      //   }
      //   const st = Date.now()
      //   that.setData({
      //     viewId: 1
      //   }, function() {
      //     console.log('【setData】use time', Date.now() - st)
      //     kk++
      //     avg += Date.now() - st
      //   })
      // }, 2000)
    }, 0)
  },
  itemSizeFunc: function (item, idx) {
    return {
      width: 162,
      height: 182
    }
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
