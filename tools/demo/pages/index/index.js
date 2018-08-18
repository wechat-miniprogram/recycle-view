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
    // placeholderImage: "data:image/svg+xml,%3Csvg height='140rpx' test='132rpx' width='100%25' xmlns='http://www.w3.org/2000/svg'%3E %3Crect width='50%25' x='40' height='20%25' style='fill:rgb(204,204,204);' /%3E %3C/svg%3E"
  },
  onLoad: function () {
    var ctx = createRecycleContext({
      id: 'recycleId',
      dataKey: 'recycleList',
      page: this,
      itemSize: {
        props: 'azFirst',
        cacheKey: 'cacheKey', // 预先缓存的key
        queryClass: 'recycle-itemsize', // 动态查询的class
        dataKey: 'recycleListItemSize', // 预先渲染的数据的wx:for绑定的变量
        // componentClass: 'recycle-list'
      },
      placeholderClass: ['recycle-image', 'recycle-text'],
      // itemSize: function(item) {
      //   return {
      //     width: 195,
      //     height: item.azFirst ? 130 : 120
      //   }
      // },
      // useInPage: true
    })
    this.ctx = ctx;
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
      for (var i = 0; i < 270; i++) {
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
      } else {
        item.azFirst = false
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
    const ctx = this.ctx
    const newList = this.genData()
    // console.log('recycle data is', newList)
    // API的调用方式
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
    console.log('transformRpx', ctx.transformRpx(123.5))
  },
  itemSizeFunc: function (item, idx) {
    return {
      width: 162,
      height: 182
    }
  },
  onPageScroll: function() {}, // 一定要留一个空的onPageScroll函数
  scrollToLower: function(e) {
    // 延迟1s，模拟网络请求
    if (this.isScrollToLower) return
    // console.log('【【【【trigger scrollToLower')
    this.isScrollToLower = true
    setTimeout(() => {
      // console.log('【【【【exec scrollToLower')
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
