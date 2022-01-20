/* eslint complexity: ["error", {"max": 50}] */
/* eslint-disable indent */
const DEFAULT_SHOW_SCREENS = 4
const RECT_SIZE = 200
const systemInfo = wx.getSystemInfoSync()
const DEBUG = false
const transformRpx = require('./utils/transformRpx.js').transformRpx

Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  relations: {
    '../recycle-item/recycle-item': {
      type: 'child', // 关联的目标节点应为子节点
      linked(target) {
        // 检查第一个的尺寸就好了吧
        if (!this._hasCheckSize) {
          this._hasCheckSize = true
          const size = this.boundingClientRect(this._pos.beginIndex)
          if (!size) {
            return
          }
          setTimeout(() => {
            try {
              target.createSelectorQuery().select('.wx-recycle-item').boundingClientRect((rect) => {
                if (rect && (rect.width !== size.width || rect.height !== size.height)) {
                  // eslint-disable-next-line no-console
                  console.warn('[recycle-view] the size in <recycle-item> is not the same with param ' +
                    `itemSize, expect {width: ${rect.width}, height: ${rect.height}} but got ` +
                    `{width: ${size.width}, height: ${size.height}}`)
                }
              }).exec()
            } catch (e) {
              // do nothing
            }
          }, 10)
        }
      }
    }
  },
  /**
   * 组件的属性列表
   */
  properties: {
    debug: {
      type: Boolean,
      value: false
    },
    scrollY: {
      type: Boolean,
      value: true,
    },
    batch: {
      type: Boolean,
      value: false,
      public: true,
      observer: '_recycleInnerBatchDataChanged'
    },
    batchKey: {
      type: String,
      value: 'batchSetRecycleData',
      public: true,
    },
    scrollTop: {
      type: Number,
      value: 0,
      public: true,
      observer: '_scrollTopChanged',
      observeAssignments: true
    },
    height: {
      type: Number,
      value: systemInfo.windowHeight,
      public: true,
      observer: '_heightChanged'
    },
    width: {
      type: Number,
      value: systemInfo.windowWidth,
      public: true,
      observer: '_widthChanged'
    },
    // 距顶部/左边多远时，触发bindscrolltoupper
    upperThreshold: {
      type: Number,
      value: 50,
      public: true,
    },
    // 距底部/右边多远时，触发bindscrolltolower
    lowerThreshold: {
      type: Number,
      value: 50,
      public: true,
    },
    scrollToIndex: {
      type: Number,
      public: true,
      value: 0,
      observer: '_scrollToIndexChanged',
      observeAssignments: true
    },
    scrollWithAnimation: {
      type: Boolean,
      public: true,
      value: false
    },
    enableBackToTop: {
      type: Boolean,
      public: true,
      value: false
    },
    // 是否节流，默认是
    throttle: {
      type: Boolean,
      public: true,
      value: true
    },
    placeholderImage: {
      type: String,
      public: true,
      value: ''
    },
    screen: { // 默认渲染多少屏的数据
      type: Number,
      public: true,
      value: DEFAULT_SHOW_SCREENS
    },
    // 以下是自定义组件下拉刷新属性
    "refresherEnabled": Boolean,
    "refresherThreshold": {
      type: Number,
      value: 45
    },
    "refresherDefaultStyle": {
      type: String,
      value: 'black'
    },
    "refresherBackground": {
      type: String,
      value: '#FFF'
    },
    "refresherTriggered": Boolean
  },

  /**
   * 组件的初始数据
   */
  data: {
    innerBeforeHeight: 0,
    innerAfterHeight: 0,
    innerScrollTop: 0,
    innerScrollIntoView: '',
    placeholderImageStr: '',
    totalHeight: 0,
    useInPage: false
  },
  attached() {
    if (this.data.placeholderImage) {
      this.setData({
        placeholderImageStr: transformRpx(this.data.placeholderImage, true)
      })
    }
    this.setItemSize({
      array: [],
      map: {},
      totalHeight: 0
    })
  },
  ready() {
    this._initPosition(() => {
      this._isReady = true // DOM结构ready了
      // 有一个更新的timer在了
      if (this._updateTimerId) return

      this._scrollViewDidScroll({
        detail: {
          scrollLeft: this._pos.left,
          scrollTop: this._pos.top,
          ignoreScroll: true
        }
      }, true)
    })
  },
  detached() {
    this.page = null
    // 销毁对应的RecycleContext
    if (this.context) {
      this.context.destroy()
      this.context = null
    }
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _log(...args) {
      if (!DEBUG && !this.data.debug) return
      const h = new Date()
      const str = `${h.getHours()}:${h.getMinutes()}:${h.getSeconds()}.${h.getMilliseconds()}`
      Array.prototype.splice.call(args, 0, 0, str)
      // eslint-disable-next-line no-console
      console.log(...args)
    },
    _scrollToUpper(e) {
      this.triggerEvent('scrolltoupper', e.detail)
    },
    _scrollToLower(e) {
      this.triggerEvent('scrolltolower', e.detail)
    },
    _refresherrefresh(e) {
      this.triggerEvent('refresherrefresh', e.detail);
    },
    _beginToScroll() {
      if (!this._lastScrollTop) {
        this._lastScrollTop = this._pos && (this._pos.top || 0)
      }
    },
    _clearList(cb) {
      this.currentScrollTop = 0
      this._lastScrollTop = 0
      const pos = this._pos
      pos.beginIndex = this._pos.endIndex = -1
      pos.afterHeight = pos.minTop = pos.maxTop = 0
      this.page._recycleViewportChange({
        detail: {
          data: pos,
          id: this.id
        }
      }, cb)
    },
    // 判断RecycleContext是否Ready
    _isValid() {
      return this.page && this.context && this.context.isDataReady
    },
    // eslint-disable-next-line no-complexity
    _scrollViewDidScroll(e, force) {
      // 如果RecycleContext还没有初始化, 不做任何事情
      if (!this._isValid()) {
        return
      }
      // 监测白屏时间
      if (!e.detail.ignoreScroll) {
        this.triggerEvent('scroll', e.detail)
      }
      this.currentScrollTop = e.detail.scrollTop
      // 高度为0的情况, 不做任何渲染逻辑
      if (!this._pos.height || !this.sizeArray.length) {
        // 没有任何数据的情况下, 直接清理所有的状态
        this._clearList(e.detail.cb)
        return
      }

      // 在scrollWithAnimation动画最后会触发一次scroll事件, 这次scroll事件必须要被忽略
      if (this._isScrollingWithAnimation) {
        this._isScrollingWithAnimation = false
        return
      }
      const pos = this._pos
      const that = this
      const scrollLeft = e.detail.scrollLeft
      const scrollTop = e.detail.scrollTop
      const scrollDistance = Math.abs(scrollTop - this._lastScrollTop)
      if (!force && (Math.abs(scrollTop - pos.top) < pos.height * 1.5)) {
        this._log('【not exceed height')
        return
      }
      this._lastScrollTop = scrollTop
      const SHOW_SCREENS = this.data.screen // 固定4屏幕
      this._log('SHOW_SCREENS', SHOW_SCREENS, scrollTop)
      this._calcViewportIndexes(scrollLeft, scrollTop,
          (beginIndex, endIndex, minTop, afterHeight, maxTop) => {
        that._log('scrollDistance', scrollDistance, 'indexes', beginIndex, endIndex)
        // 渲染的数据不变
        if (!force && pos.beginIndex === beginIndex && pos.endIndex === endIndex &&
            pos.minTop === minTop && pos.afterHeight === afterHeight) {
          that._log('------------is the same beginIndex and endIndex')
          return
        }
        // 如果这次渲染的范围比上一次的范围小，则忽略
        that._log('【check】before setData, old pos is', pos.minTop, pos.maxTop, minTop, maxTop)
        that._throttle = false
        pos.left = scrollLeft
        pos.top = scrollTop
        pos.beginIndex = beginIndex
        pos.endIndex = endIndex
        // console.log('render indexes', endIndex - beginIndex + 1, endIndex, beginIndex)
        pos.minTop = minTop
        pos.maxTop = maxTop
        pos.afterHeight = afterHeight
        pos.ignoreBeginIndex = pos.ignoreEndIndex = -1
        that.page._recycleViewportChange({
          detail: {
            data: that._pos,
            id: that.id
          }
        }, () => {
          if (e.detail.cb) {
            e.detail.cb()
          }
        })
      })
    },
    // 计算在视窗内渲染的数据
    _calcViewportIndexes(left, top, cb) {
      const that = this
      // const st = +new Date
      this._getBeforeSlotHeight(() => {
        const {
          beginIndex, endIndex, minTop, afterHeight, maxTop
        } = that.__calcViewportIndexes(left, top)
        if (cb) {
          cb(beginIndex, endIndex, minTop, afterHeight, maxTop)
        }
      })
    },
    _getBeforeSlotHeight(cb) {
      if (typeof this.data.beforeSlotHeight !== 'undefined') {
        if (cb) {
          cb(this.data.beforeSlotHeight)
        }
      } else {
        this.reRender(cb)
      }
    },
    _getAfterSlotHeight(cb) {
      if (typeof this.data.afterSlotHeight !== 'undefined') {
        if (cb) {
          cb(this.data.afterSlotHeight)
        }
        // cb && cb(this.data.afterSlotHeight)
      } else {
        this.reRender(cb)
      }
    },
    _getIndexes(minTop, maxTop) {
      if (minTop === maxTop && maxTop === 0) {
        return {
          beginIndex: -1,
          endIndex: -1
        }
      }
      const startLine = Math.floor(minTop / RECT_SIZE)
      const endLine = Math.ceil(maxTop / RECT_SIZE)
      const rectEachLine = Math.floor(this.data.width / RECT_SIZE)
      let beginIndex
      let endIndex
      const sizeMap = this.sizeMap
      for (let i = startLine; i <= endLine; i++) {
        for (let col = 0; col <= rectEachLine; col++) {
          const key = `${i}.${col}`
          // 找到sizeMap里面的最小值和最大值即可
          if (!sizeMap[key]) continue
          for (let j = 0; j < sizeMap[key].length; j++) {
            if (typeof beginIndex === 'undefined') {
              beginIndex = endIndex = sizeMap[key][j]
              continue
            }
            if (beginIndex > sizeMap[key][j]) {
              beginIndex = sizeMap[key][j]
            } else if (endIndex < sizeMap[key][j]) {
              endIndex = sizeMap[key][j]
            }
          }
        }
      }
      return {
        beginIndex,
        endIndex
      }
    },
    _isIndexValid(beginIndex, endIndex) {
      if (typeof beginIndex === 'undefined' || beginIndex === -1 ||
        typeof endIndex === 'undefined' || endIndex === -1 || endIndex >= this.sizeArray.length) {
        return false
      }
      return true
    },
    __calcViewportIndexes(left, top) {
      if (!this.sizeArray.length) return {}
      const pos = this._pos
      if (typeof left === 'undefined') {
        (left = pos.left)
      }
      if (typeof top === 'undefined') {
        (top = pos.top)
      }
      // top = Math.max(top, this.data.beforeSlotHeight)
      const beforeSlotHeight = this.data.beforeSlotHeight || 0
      // 和direction无关了
      const SHOW_SCREENS = this.data.screen
      let minTop = top - pos.height * SHOW_SCREENS - beforeSlotHeight
      let maxTop = top + pos.height * SHOW_SCREENS - beforeSlotHeight
      // maxTop或者是minTop超出了范围
      if (maxTop > this.totalHeight) {
        minTop -= (maxTop - this.totalHeight)
        maxTop = this.totalHeight
      }
      if (minTop < beforeSlotHeight) {
        maxTop += Math.min(beforeSlotHeight - minTop, this.totalHeight)
        minTop = 0
      }
      // 计算落在minTop和maxTop之间的方格有哪些
      const indexObj = this._getIndexes(minTop, maxTop)
      const beginIndex = indexObj.beginIndex
      let endIndex = indexObj.endIndex
      if (endIndex >= this.sizeArray.length) {
        endIndex = this.sizeArray.length - 1
      }
      // 校验一下beginIndex和endIndex的有效性,
      if (!this._isIndexValid(beginIndex, endIndex)) {
        return {
          beginIndex: -1,
          endIndex: -1,
          minTop: 0,
          afterHeight: 0,
          maxTop: 0
        }
      }
      // 计算白屏的默认占位的区域
      const maxTopFull = this.sizeArray[endIndex].beforeHeight + this.sizeArray[endIndex].height
      const minTopFull = this.sizeArray[beginIndex].beforeHeight

      // console.log('render indexes', beginIndex, endIndex)
      const afterHeight = this.totalHeight - maxTopFull
      return {
        beginIndex,
        endIndex,
        minTop: minTopFull, // 取整, beforeHeight的距离
        afterHeight,
        maxTop,
      }
    },
    setItemSize(size) {
      this.sizeArray = size.array
      this.sizeMap = size.map
      if (size.totalHeight !== this.totalHeight) {
        // console.log('---totalHeight is', size.totalHeight);
        this.setData({
          totalHeight: size.totalHeight,
          useInPage: this.useInPage || false
        })
      }
      this.totalHeight = size.totalHeight
    },
    setList(key, newList) {
      this._currentSetDataKey = key
      this._currentSetDataList = newList
    },
    setPage(page) {
      this.page = page
    },
    forceUpdate(cb, reInit) {
      if (!this._isReady) {
        if (this._updateTimerId) {
          // 合并多次的forceUpdate
          clearTimeout(this._updateTimerId)
        }
        this._updateTimerId = setTimeout(() => {
          this.forceUpdate(cb, reInit)
        }, 10)
        return
      }
      this._updateTimerId = null
      const that = this
      if (reInit) {
        this.reRender(() => {
          that._scrollViewDidScroll({
            detail: {
              scrollLeft: that._pos.left,
              scrollTop: that.currentScrollTop || that.data.scrollTop || 0,
              ignoreScroll: true,
              cb
            }
          }, true)
        })
      } else {
        this._scrollViewDidScroll({
          detail: {
            scrollLeft: that._pos.left,
            scrollTop: that.currentScrollTop || that.data.scrollTop || 0,
            ignoreScroll: true,
            cb
          }
        }, true)
      }
    },
    _initPosition(cb) {
      const that = this
      that._pos = {
        left: that.data.scrollLeft || 0,
        top: that.data.scrollTop || 0,
        width: this.data.width,
        height: Math.max(500, this.data.height), // 一个屏幕的高度
        direction: 0
      }
      this.reRender(cb)
    },
    _widthChanged(newVal) {
      if (!this._isReady) return newVal
      this._pos.width = newVal
      this.forceUpdate()
      return newVal
    },
    _heightChanged(newVal) {
      if (!this._isReady) return newVal
      this._pos.height = Math.max(500, newVal)
      this.forceUpdate()
      return newVal
    },
    reRender(cb) {
      let beforeSlotHeight
      let afterSlotHeight
      const that = this
      // const reRenderStart = Date.now()
      function newCb() {
        if (that._lastBeforeSlotHeight !== beforeSlotHeight ||
            that._lastAfterSlotHeight !== afterSlotHeight) {
          that.setData({
            hasBeforeSlotHeight: true,
            hasAfterSlotHeight: true,
            beforeSlotHeight,
            afterSlotHeight
          })
        }
        that._lastBeforeSlotHeight = beforeSlotHeight
        that._lastAfterSlotHeight = afterSlotHeight
        // console.log('_getBeforeSlotHeight use time', Date.now() - reRenderStart)
        if (cb) {
          cb()
        }
      }
      // 重新渲染事件发生
      let beforeReady = false
      let afterReady = false
      // fix：#16 确保获取slot节点实际高度
      this.setData({
        hasBeforeSlotHeight: false,
        hasAfterSlotHeight: false,
      }, () => {
        this.createSelectorQuery().select('.slot-before').boundingClientRect((rect) => {
          beforeSlotHeight = rect.height
          beforeReady = true
          if (afterReady) {
            if (newCb) { newCb() }
          }
        }).exec()
        this.createSelectorQuery().select('.slot-after').boundingClientRect((rect) => {
          afterSlotHeight = rect.height
          afterReady = true
          if (beforeReady) {
            if (newCb) { newCb() }
          }
        }).exec()
      })
    },
    _setInnerBeforeAndAfterHeight(obj) {
      if (typeof obj.beforeHeight !== 'undefined') {
        this._tmpBeforeHeight = obj.beforeHeight
      }
      if (obj.afterHeight) {
        this._tmpAfterHeight = obj.afterHeight
      }
    },
    _recycleInnerBatchDataChanged(cb) {
      if (typeof this._tmpBeforeHeight !== 'undefined') {
        const setObj = {
          innerBeforeHeight: this._tmpBeforeHeight || 0,
          innerAfterHeight: this._tmpAfterHeight || 0
        }
        if (typeof this._tmpInnerScrollTop !== 'undefined') {
          setObj.innerScrollTop = this._tmpInnerScrollTop
        }
        const pageObj = {}
        let hasPageData = false
        if (typeof this._currentSetDataKey !== 'undefined') {
          pageObj[this._currentSetDataKey] = this._currentSetDataList
          hasPageData = true
        }
        const saveScrollWithAnimation = this.data.scrollWithAnimation
        const groupSetData = () => {
          // 如果有分页数据的话
          if (hasPageData) {
            this.page.setData(pageObj)
          }
          this.setData(setObj, () => {
            this.setData({
              scrollWithAnimation: saveScrollWithAnimation
            })
            if (typeof cb === 'function') {
              cb()
            }
          })
        }
        groupSetData()
        delete this._currentSetDataKey
        delete this._currentSetDataList
        this._tmpBeforeHeight = undefined
        this._tmpAfterHeight = undefined
        this._tmpInnerScrollTop = undefined
      }
    },
    _renderByScrollTop(scrollTop) {
      // 先setData把目标位置的数据补齐
      this._scrollViewDidScroll({
        detail: {
          scrollLeft: this._pos.scrollLeft,
          scrollTop,
          ignoreScroll: true
        }
      }, true)
      if (this.data.scrollWithAnimation) {
        this._isScrollingWithAnimation = true
      }
      this.setData({
        innerScrollTop: scrollTop
      })
    },
    _scrollTopChanged(newVal, oldVal) {
      // if (newVal === oldVal && newVal === 0) return
      if (!this._isInitScrollTop && newVal === 0) {
        this._isInitScrollTop = true
        return newVal
      }
      this.currentScrollTop = newVal
      if (!this._isReady) {
        if (this._scrollTopTimerId) {
          clearTimeout(this._scrollTopTimerId)
        }
        this._scrollTopTimerId = setTimeout(() => {
          this._scrollTopChanged(newVal, oldVal)
        }, 10)
        return newVal
      }
      this._isInitScrollTop = true
      this._scrollTopTimerId = null
      // this._lastScrollTop = oldVal
      if (typeof this._lastScrollTop === 'undefined') {
        this._lastScrollTop = this.data.scrollTop
      }
      // 滑动距离小于一个屏幕的高度, 直接setData
      if (Math.abs(newVal - this._lastScrollTop) < this._pos.height) {
        this.setData({
          innerScrollTop: newVal
        })
        return newVal
      }
      if (!this._isScrollTopChanged) {
        // 首次的值需要延后一点执行才能生效
        setTimeout(() => {
          this._isScrollTopChanged = true
          this._renderByScrollTop(newVal)
        }, 10)
      } else {
        this._renderByScrollTop(newVal)
      }
      return newVal
    },
    _scrollToIndexChanged(newVal, oldVal) {
      // if (newVal === oldVal && newVal === 0) return
      // 首次滚动到0的不执行
      if (!this._isInitScrollToIndex && newVal === 0) {
        this._isInitScrollToIndex = true
        return newVal
      }
      if (!this._isReady) {
        if (this._scrollToIndexTimerId) {
          clearTimeout(this._scrollToIndexTimerId)
        }
        this._scrollToIndexTimerId = setTimeout(() => {
          this._scrollToIndexChanged(newVal, oldVal)
        }, 10)
        return newVal
      }
      this._isInitScrollToIndex = true
      this._scrollToIndexTimerId = null
      if (typeof this._lastScrollTop === 'undefined') {
        this._lastScrollTop = this.data.scrollTop
      }
      const rect = this.boundingClientRect(newVal)
      if (!rect) return newVal
        // console.log('rect top', rect, this.data.beforeSlotHeight)
      const calScrollTop = rect.top + (this.data.beforeSlotHeight || 0)
      this.currentScrollTop = calScrollTop
      if (Math.abs(calScrollTop - this._lastScrollTop) < this._pos.height) {
        this.setData({
          innerScrollTop: calScrollTop
        })
        return newVal
      }
      if (!this._isScrollToIndexChanged) {
        setTimeout(() => {
          this._isScrollToIndexChanged = true
          this._renderByScrollTop(calScrollTop)
        }, 10)
      } else {
        this._renderByScrollTop(calScrollTop)
      }
      return newVal
    },
    // 提供给开发者使用的接口
    boundingClientRect(idx) {
      if (idx < 0 || idx >= this.sizeArray.length) {
        return null
      }
      return {
        left: 0,
        top: this.sizeArray[idx].beforeHeight,
        width: this.sizeArray[idx].width,
        height: this.sizeArray[idx].height
      }
    },
    // 获取当前出现在屏幕内数据项， 返回数据项组成的数组
    // 参数inViewportPx表示当数据项至少有多少像素出现在屏幕内才算是出现在屏幕内，默认是1
    getIndexesInViewport(inViewportPx) {
      if (!inViewportPx) {
        (inViewportPx = 1)
      }
      const scrollTop = this.currentScrollTop
      let minTop = scrollTop + inViewportPx
      if (minTop < 0) minTop = 0
      let maxTop = scrollTop + this.data.height - inViewportPx
      if (maxTop > this.totalHeight) maxTop = this.totalHeight
      const indexes = []
      for (let i = 0; i < this.sizeArray.length; i++) {
        if (this.sizeArray[i].beforeHeight + this.sizeArray[i].height >= minTop &&
            this.sizeArray[i].beforeHeight <= maxTop) {
          indexes.push(i)
        }
        if (this.sizeArray[i].beforeHeight > maxTop) break
      }
      return indexes
    },
    getTotalHeight() {
      return this.totalHeight
    },
    setUseInPage(useInPage) {
      this.useInPage = useInPage
    },
    setPlaceholderImage(svgs, size) {
      const fill = 'style=\'fill:rgb(204,204,204);\''
      const placeholderImages = [`data:image/svg+xml,%3Csvg height='${size.height}' width='${size.width}' xmlns='http://www.w3.org/2000/svg'%3E`]
      svgs.forEach(svg => {
        placeholderImages.push(`%3Crect width='${svg.width}' x='${svg.left}' height='${svg.height}' y='${svg.top}' ${fill} /%3E`)
      })
      placeholderImages.push('%3C/svg%3E')
      this.setData({
        placeholderImageStr: placeholderImages.join('')
      })
    }
  }
})
