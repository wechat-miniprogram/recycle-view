//logs.js

Page({
  data: {
    enable: false,
    loading: false,
    title: '',
    titleStyle: '',
    bgStyle: 'position: fixed',
    delta: 2
  },
  onLoad() {
  },
  onnavback(e) {
    console.log('navback', e)
  },
  setTitle() {
    if (this.data.title !== '微信') {
      this.setData({
        title: '微信'
      })
    } else {
      this.setData({
        title: 'WeChat'
      })
    }
  },
  setLoading() {
    if (this.data.loading === false) {
      this.setData({
        loading: true
      })
    } else {
      this.setData({
        loading: false
      })
    }
  },
  setNavBack() {
    if (this.data.enable === false) {
      this.setData({
        enable: true
      })
    } else {
      this.setData({
        enable: false
      })
    }
  },
  setTitleStyle() {
    if (this.data.titleStyle !== 'color: #333300;') {
      this.setData({
        titleStyle: 'color: #333300;'
      })
    } else {
      this.setData({
        titleStyle: 'color: #fff;'
      })
    }
  },
  setBgStyle() {
    if (this.data.bgStyle !== 'background-color: #60A718;') {
      this.setData({
        bgStyle: 'background-color: #60A718;'
      })
    } else {
      this.setData({
        bgStyle: 'background-color: #000;'
      })
    }
  }
})
