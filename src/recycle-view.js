let SHOW_SCREENS = 4
let MAX_SHOW_SCREENS = 5 // 5和3刚好合适？
const DEFAULT_SHOW_SCREENS = SHOW_SCREENS
const DEFAULT_MAX_SHOW_SCREENS = MAX_SHOW_SCREENS
const MAX_SHOW_SCREENS_IN_DIRECTION = 6
const RECT_SIZE = 200
const systemInfo = wx.getSystemInfoSync()
const DEBUG = false
const BOUNDARY_INTERVAL = 400 // 到达边界多少距离的时候, 直接改为边界位置
const THROTTLE_DISTANCE = 2000 // 超过这个的滚动距离必须要抛弃掉
const SETDATA_INTERVAL_BOUNDARY = 300 // 大于300ms则减少MAX_SHOW_SCREEN的值
const SETDATA_INTERVAL_BOUNDARY_1 = 500
const transformRpx = require('./utils/transformRpx.js').transformRpx

Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  relations: {
    '../recycle-item/recycle-item': {
      type: 'child', // 关联的目标节点应为子节点
      linked: function (target) {
        // 检查第一个的尺寸就好了吧
        if (!this._hasCheckSize) {
          this._hasCheckSize = true
          const size = this.boundingClientRect(this._pos.beginIndex)
          if (!size) {
            return
          }
          setTimeout(function() {
            try {
              target.createSelectorQuery().select('.wx-recycle-item').boundingClientRect(function(rect) {
                if (rect && (rect.width !== size.width || rect.height !== size.height)) {
                  // console.warn('[recycle-view] the size in <recycle-item> is not the same with param itemSize')
                  // eslint-disable-next-line no-console
                  console.warn(`[recycle-view] the size in <recycle-item> is not the same with param itemSize, expect {width: ${rect.width}, height: ${rect.height}} but got {width: ${size.width}, height: ${size.height}}`)
                }
              }).exec()
            } catch(e) {
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
    batch: {
      type: Boolean,
      value: false,
      observer: '_recycleInnerBatchDataChanged'
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
    }
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
  attached: function() {
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
  ready: function() {
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
    this._totalTime = this._totalCount = 0
  },
  detached: function() {
    this.page = null
    // 销毁对应的RecycleContext
    if (this.context) {
      this.context.destroy()
      this.context = null
    }
    if (this.timerId) clearTimeout(this.timerId)
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _log: function() {
      if (!DEBUG && !this.data.debug) return
      const h = new Date
      const str = `${h.getHours()}:${h.getMinutes()}:${h.getSeconds()}.${h.getMilliseconds()}`
      Array.prototype.splice.call(arguments, 0, 0, str)
      // eslint-disable-next-line no-console
      console.log.apply(console, arguments)
    },
    _scrollToUpper: function(e) {
      this.triggerEvent('scrolltoupper', e.detail)
    },
    _scrollToLower: function(e) {
      this.triggerEvent('scrolltolower', e.detail)
    },
    _beginToScroll: function(e) {
      this._lastRenderTime = Date.now()
      if (!this._lastScrollTop) {
        this._lastScrollTop = this._pos && this._pos.top || 0
      }
    },
    _clearList: function(cb) {
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
    _isValid: function() {
      return this.page && this.context && this.context.isDataReady
    },
    _scrollViewDidScroll: function(e, force) {
      // 如果RecycleContext还没有初始化, 不做任何事情
      if (!this._isValid()) {
        return;
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
      let scrollTop = e.detail.scrollTop
      let isMatchBoundary = false
      if (scrollTop - BOUNDARY_INTERVAL < 0) {
        // scrollTop = 0
        isMatchBoundary = true
      }
      if (this.totalHeight - scrollTop - BOUNDARY_INTERVAL < this.data.height) {
        // scrollTop = this.totalHeight - this.data.height
        // isMatchBoundary = true
      }
      const usetime = Date.now() - this._lastRenderTime
      const scrollDistance = Math.abs(scrollTop - this._lastScrollTop)
      const speed = usetime ? scrollDistance / usetime : 0
      const distance = Math.abs(speed * 300) // 预测未来100ms之内经过的距离

      this._lastScrollTop = scrollTop
      this._lastRenderTime = Date.now()
      // 当scroll触发时间大于200ms且大于滚动距离，下一个滚动距离会极高，容易出现白屏，因此需要马上渲染
      // const isNextScrollExpose = (usetime > 300 && usetime > scrollDistance)
      const isNextScrollExpose = false;
      // const mustRender = force || isMatchBoundary || isNextScrollExpose
      const mustRender = force || isNextScrollExpose
      this._log('scrollTop', e.detail.scrollTop, isMatchBoundary, mustRender)
      if (!mustRender) {
        if ((Math.abs(scrollTop - pos.top) < pos.height*1.5)) {
          this._log('【not exceed height')
          return
        }
        if ((scrollDistance > THROTTLE_DISTANCE || this._isScrollRendering)) {
          this._throttle = true
          this._log('【throttle because', scrollDistance, this._throttle)
          return
        }
      }
      // 300ms内, 上一次setData未完成，抛弃掉这次的setData
      // 上次是节流状态, 这次不执行节流判断逻辑
      // if (!force && !this._throttle && !isNextScrollExpose && Date.now() - pos.lastSetDataTime < 3000 &&
      //     (Date.now() - pos.lastSetDataTime < 300 || distance > (SHOW_SCREENS*2-1)*pos.height)) {
      //   this._throttle = true
      //   setViewportChangeInTimeout(500)
      //   return
      // }
      // 重新计算SHOW_SCREENS
      if (!force) {
        if (isNextScrollExpose) {
          SHOW_SCREENS = MAX_SHOW_SCREENS
        } else if (distance && isFinite(distance)) {
          const newShowScreen = Math.ceil(distance / pos.height)
          SHOW_SCREENS = Math.min(MAX_SHOW_SCREENS, Math.max(newShowScreen, DEFAULT_SHOW_SCREENS))
        } else {
          SHOW_SCREENS = DEFAULT_SHOW_SCREENS
        }
      } else {
        SHOW_SCREENS = DEFAULT_SHOW_SCREENS
      }
      if (force && this.timerId) {
        clearTimeout(this.timerId)
      }
      SHOW_SCREENS = DEFAULT_SHOW_SCREENS // 固定4屏幕
      pos.direction = force ? 0 : scrollTop - pos.top > 0 ? 1 : -1
      this._log('SHOW_SCREENS', SHOW_SCREENS, scrollTop, isNextScrollExpose)
      this._calcViewportIndexes(scrollLeft, scrollTop, function (beginIndex, endIndex, minTop, afterHeight, maxTop) {
        that._log('scrollDistance', scrollDistance, 'usetime', usetime, 'indexes', beginIndex, endIndex)
        // 渲染的数据不变
        if (!force && pos.beginIndex === beginIndex && pos.endIndex === endIndex &&
            pos.minTop === minTop && pos.afterHeight === afterHeight) {
          that._log('------------is the same beginIndex and endIndex')
          return
        }
        // 如果这次渲染的范围比上一次的范围小，则忽略
        // if (!force && !isMatchBoundary && ((pos.direction === 1 && (maxTop <= pos.maxTop)) ||
        //     (pos.direction === -1 && (minTop > pos.minTop))
        // )) {
        //   that._log('------------ignoreMinTop')
        //   return
        // }
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
        pos.lastSetDataTime = Date.now() // 用于节流时间判断
        that._isScrollRendering = true
        const st = Date.now()
        that.page._recycleViewportChange({
          detail: {
            data: that._pos,
            id: that.id
          }
        }, function() {
          that._isScrollRendering = false
          if (that._totalCount < 5) {
            that._totalCount++
            that._totalTime+=(Date.now() - st)
          } else {
            that._totalCount = 1
            that._totalTime=(Date.now() - st)
          }
          // that._log('【setData complete for', minTop, maxTop, 'use time', Date.now() - pos.lastSetDataTime, that._totalCount / that._totalTime)
          pos.lastSetDataTime = 0 // 用于节流时间判断
          // if (that._totalCount / that._totalTime <= SETDATA_INTERVAL_BOUNDARY) {
          //   MAX_SHOW_SCREENS = DEFAULT_MAX_SHOW_SCREENS + 1 // 多渲染2个屏幕的内容
          if (that._totalTime / that._totalCount > SETDATA_INTERVAL_BOUNDARY) {
            that._log('【【SHOW_SCREENS 调整', that._totalCount / that._totalTime)
            MAX_SHOW_SCREENS = DEFAULT_MAX_SHOW_SCREENS - 1
          } else if (that._totalTime / that._totalCount > SETDATA_INTERVAL_BOUNDARY_1) {
            MAX_SHOW_SCREENS = DEFAULT_MAX_SHOW_SCREENS - 2
          }
          e.detail.cb && e.detail.cb()
        })
      })
    },
    // 计算在视窗内渲染的数据
    _calcViewportIndexes: function(left, top, cb) {
      const that = this
      const st = +new Date
      this._getBeforeSlotHeight(function(rect) {
        const { beginIndex, endIndex, minTop, afterHeight, maxTop } = that.__calcViewportIndexes(left, top)
        cb && cb(beginIndex, endIndex, minTop, afterHeight, maxTop)
      })
    },
    _getBeforeSlotHeight: function(cb) {
      if (typeof this.data.beforeSlotHeight !== 'undefined') {
        cb && cb(this.data.beforeSlotHeight)
      } else {
        this.reRender(cb)
      }
    },
    _getAfterSlotHeight: function(cb) {
      if (typeof this.data.afterSlotHeight !== 'undefined') {
        cb && cb(this.data.afterSlotHeight)
      } else {
        this.reRender(cb)
      }
    },
    _getIndexes: function(minTop, maxTop) {
      if (minTop == maxTop  && maxTop == 0) {
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
      var st = Date.now()
      for (let i = startLine; i <= endLine; i++) {
        for (let col = 0; col < rectEachLine; col++) {
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
        beginIndex: beginIndex,
        endIndex: endIndex
      }
    },
    _isIndexValid: function(beginIndex, endIndex) {
      if (typeof beginIndex === 'undefined' || beginIndex == -1 ||
        typeof endIndex === 'undefined' || endIndex == -1 || endIndex >= this.sizeArray.length) {
        return false
      }
      return true;
    },
    __calcViewportIndexes: function (left, top) {
      if (!this.sizeArray.length) return
      const pos = this._pos;
      (typeof left === 'undefined') && (left = pos.left);
      (typeof top === 'undefined') && (top = pos.top);
      // top = Math.max(top, this.data.beforeSlotHeight)
      const beforeSlotHeight = this.data.beforeSlotHeight || 0
      // 和direction无关了
      // let minTop = top - pos.height * (pos.direction == 1 ? 1 : pos.direction == -1 ? SHOW_SCREENS*2 : SHOW_SCREENS) - beforeSlotHeight
      // let maxTop = top + pos.height * (pos.direction == 1 ? SHOW_SCREENS * 2 : pos.direction == -1 ? 1 : SHOW_SCREENS) - beforeSlotHeight
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
      let {beginIndex, endIndex} = this._getIndexes(minTop, maxTop)
      if (endIndex >= this.sizeArray.length) {
        endIndex = this.sizeArray.length - 1;
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
      const whiteSpaceHeight = MAX_SHOW_SCREENS * pos.height*3 // max_show_screens的高度刚好合适？
      let maxTopFull = this.sizeArray[endIndex].beforeHeight + this.sizeArray[endIndex].height
      let minTopFull = this.sizeArray[beginIndex].beforeHeight

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
    setItemSize: function(size) {
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
    setList: function(key, newList) {
      this._currentSetDataKey = key
      this._currentSetDataList = newList
    },
    setPage: function(page) {
      this.page = page
    },
    forceUpdate: function(cb, reInit) {
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
        this.reRender(function() {
          that._scrollViewDidScroll({
            detail: {
              scrollLeft: that._pos.left,
              scrollTop: that.currentScrollTop || that.data.scrollTop || 0,
              ignoreScroll: true,
              cb: cb
            }
          }, true)

        })
      } else {
        this._scrollViewDidScroll({
          detail: {
            scrollLeft: that._pos.left,
            scrollTop: that.currentScrollTop || that.data.scrollTop || 0,
            ignoreScroll: true,
            cb: cb
          }
        }, true)
      }
    },
    _initPosition: function(cb) {
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
    _widthChanged: function(newVal, oldVal) {
      if (!this._isReady) return newVal
      this._pos.width = newVal
      this.forceUpdate()
      return newVal
    },
    _heightChanged: function(newVal, oldVal) {
      if (!this._isReady) return newVal
      this._pos.height = Math.max(500, newVal)
      this.forceUpdate()
      return newVal
    },
    reRender: function(cb) {
      let beforeSlotHeight
      let afterSlotHeight
      const that = this;
      // const reRenderStart = Date.now()
      function newCb() {
        if (that._lastBeforeSlotHeight !== beforeSlotHeight || that._lastAfterSlotHeight !== afterSlotHeight) {
          that.setData({
            hasBeforeSlotHeight: true,
            hasAfterSlotHeight: true,
            beforeSlotHeight: beforeSlotHeight,
            afterSlotHeight: afterSlotHeight
          })

        }
        that._lastBeforeSlotHeight = beforeSlotHeight
        that._lastAfterSlotHeight = afterSlotHeight
        // console.log('_getBeforeSlotHeight use time', Date.now() - reRenderStart)
        cb && cb()
      }
      // 重新渲染事件发生
      let beforeReady = false
      let afterReady = false
      this.createSelectorQuery().select('.slot-before').boundingClientRect(function(rect) {
        beforeSlotHeight = rect.height
        beforeReady = true
        if (afterReady) {
          newCb && newCb()
        }
      }).exec()
      this.createSelectorQuery().select('.slot-after').boundingClientRect(function(rect) {
        afterSlotHeight = rect.height
        afterReady = true
        if (beforeReady) {
          newCb && newCb()
        }
      }).exec()
    },
    _setInnerBeforeAndAfterHeight(obj) {
      if (typeof obj.beforeHeight !== 'undefined') {
        this._tmpBeforeHeight = obj.beforeHeight
      }
      obj.afterHeight && (this._tmpAfterHeight = obj.afterHeight)
    },
    _recycleInnerBatchDataChanged: function () {
      if (typeof this._tmpBeforeHeight !== 'undefined') {
        const setObj = {
          innerBeforeHeight: this._tmpBeforeHeight || 0,
          innerAfterHeight: this._tmpAfterHeight || 0
        }
        if (typeof this._tmpInnerScrollTop !== 'undefined') {
          setObj.innerScrollTop = this._tmpInnerScrollTop
        }
        const pageObj = {}
        if (typeof this._currentSetDataKey !== 'undefined') {
          pageObj[this._currentSetDataKey] = this._currentSetDataList
          this.page.setData(pageObj)
        }
        const saveScrollWithAnimation = this.data.scrollWithAnimation
        const st = +new Date
        this.setData(setObj, () => {
          this.setData({
            scrollWithAnimation: saveScrollWithAnimation
          })
        })
        delete this._currentSetDataKey
        delete this._currentSetDataList
        this._tmpBeforeHeight = undefined
        this._tmpAfterHeight = undefined
        this._tmpInnerScrollTop = undefined
      }
    },
    _scrollTopChanged: function(newVal, oldVal) {
      // if (newVal === oldVal && newVal === 0) return
      if (!this._isInitScrollTop && newVal === 0) {
        this._isInitScrollTop = true
        return
      }
      this.currentScrollTop = newVal
      if (!this._isReady) {
        if (this._scrollTopTimerId) {
          clearTimeout(this._scrollTopTimerId)
        }
        this._scrollTopTimerId = setTimeout(() => {
          this._scrollTopChanged(newVal, oldVal)
        }, 10)
        return
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
        return
      }
      if (this.data.scrollWithAnimation) {
        // 先setData把目标位置的数据补齐
        this._scrollViewDidScroll({
          detail: {
            scrollLeft: this._pos.scrollLeft,
            scrollTop: newVal,
            ignoreScroll: true
          }
        }, true)
        this._isScrollingWithAnimation = true
        this.setData({
          innerScrollTop: newVal
        })
        // this._innerScrollChangeWithAnimation(newVal, newVal - this._lastScrollTop > 0)
      } else {
        if (!this._isScrollTopChanged) {
          // 首次的值需要延后一点执行才能生效
          setTimeout(() => {
            this._isScrollTopChanged = true
            this.setData({
              innerScrollTop: newVal
            })
          }, 10)
        } else {
          this.setData({
            innerScrollTop: newVal
          })
        }
      }
      return newVal
    },
    // 此方法废弃, 会闪烁一下
    _innerScrollChangeWithAnimation: function(newScrollTop, dir) {
      this._isScrollingWithAnimation = true
      const that = this
      const pos = this._pos
      this._tmpInnerScrollTop = newScrollTop
      // 计算_pos的值, 主要是beginIndex、endIndex, ignoreBeginIndex、ignoreEndIndex、minTop、afterHeight
      // 向下滑动过程中，改变endIndex
      let {maxTop, minTop, ignoreMinTop, ignoreMaxTop} = {
        ignoreMaxTop: 0,
        ignoreMinTop: 0,
      }
      if (newScrollTop > this._lastScrollTop) {
        maxTop = newScrollTop + this.data.height - this.data.beforeSlotHeight
        minTop = this._lastScrollTop - this.data.beforeSlotHeight
      } else {
        minTop = newScrollTop - this.data.beforeSlotHeight
        maxTop = this._lastScrollTop - this.data.beforeSlotHeight
      }
      if (minTop < 0) {
        maxTop += -minTop
        minTop = 0
      }
      if (maxTop - minTop > MAX_SHOW_SCREENS_IN_DIRECTION * pos.height) {
        ignoreMinTop = minTop + (MAX_SHOW_SCREENS_IN_DIRECTION/2) * pos.height
        ignoreMaxTop = maxTop - (MAX_SHOW_SCREENS_IN_DIRECTION/2) * pos.height
      }
      const index = this._getIndexes(minTop, maxTop)
      const ignoreIndex = this._getIndexes(ignoreMinTop, ignoreMaxTop)
      pos.ignoreBeginIndex = ignoreIndex.beginIndex
      pos.ignoreEndIndex = ignoreIndex.endIndex
      pos.beginIndex = index.beginIndex
      pos.endIndex = index.endIndex
      const {beginIndex, endIndex, ignoreBeginIndex, ignoreEndIndex} = pos
      if (endIndex < 0) {
        this._isScrollingWithAnimation = false
        return
      }
      pos.minTop = this.sizeArray[beginIndex].beforeHeight
      pos.maxTop = maxTop
      const innerAfterHeight = this.totalHeight - this.sizeArray[endIndex].beforeHeight - this.sizeArray[endIndex].height
      const ignoreHeight = (ignoreEndIndex != -1 ? this.sizeArray[ignoreEndIndex].beforeHeight - this.sizeArray[ignoreBeginIndex].beforeHeight : 0)
      pos.afterHeight = innerAfterHeight + ignoreHeight
      // scrollTo
      // console.log('ignore height', ignoreHeight, dir, newScrollTop, pos.minTop, pos.maxTop)
      const newCalScrollTop = newScrollTop + (dir ? -ignoreHeight : ignoreHeight)
      this._tmpInnerScrollTop = newCalScrollTop
      if (ignoreHeight) {
        this._animateMockScrollTop = newCalScrollTop
        this._animateCompleteTriggerScrollTop = newScrollTop
      }
      this.page._recycleViewportChange({
        detail: {
          data: pos,
          id: that.id
        }
      }, function() {
        // that._isScrollingWithAnimation = false
        // pos.direction = 0
        // that._scrollViewDidScroll({
        //   detail: {
        //     scrollLeft: pos.left,
        //     scrollTop: newScrollTop,
        //     ignoreScroll: true
        //   }
        // }, true)
      })
    },
    _scrollToIndexChanged: function(newVal, oldVal) {
      // if (newVal === oldVal && newVal === 0) return
      // 首次滚动到0的不执行
      if (!this._isInitScrollToIndex && newVal === 0) {
        this._isInitScrollToIndex = true
        return
      }
      if (!this._isReady) {
        if (this._scrollToIndexTimerId) {
          clearTimeout(this._scrollToIndexTimerId)
        }
        this._scrollToIndexTimerId = setTimeout(() => {
          this._scrollToIndexChanged(newVal, oldVal)
        }, 10)
        return
      }
      this._isInitScrollToIndex = true
      this._scrollToIndexTimerId = null
      if (typeof this._lastScrollTop === 'undefined') {
        this._lastScrollTop = this.data.scrollTop
      }
      const rect = this.boundingClientRect(newVal)
      if (!rect) return
        // console.log('rect top', rect, this.data.beforeSlotHeight)
      const calScrollTop = rect.top + (this.data.beforeSlotHeight || 0)
      this.currentScrollTop = calScrollTop
      if (Math.abs(calScrollTop - this._lastScrollTop) < this._pos.height) {
        this.setData({
          innerScrollTop: calScrollTop
        })
        return
      }
      if (this.data.scrollWithAnimation) {
        // 有动画效果的话, 需要和scrollTopChange类似的处理方式
        // 获取newVal对应的id的clientRect
        this._scrollViewDidScroll({
          detail: {
            scrollLeft: this._pos.scrollLeft,
            scrollTop: calScrollTop,
            ignoreScroll: true
          }
        }, true)
        this._isScrollingWithAnimation = true
        this.setData({
          innerScrollTop: calScrollTop
        })
        // this._innerScrollChangeWithAnimation(calScrollTop, calScrollTop - this._lastScrollTop > 0)
      } else {
        if (!this._isScrollToIndexChanged) {
          setTimeout(() => {
            this._isScrollToIndexChanged = true
            this.setData({
              innerScrollTop: calScrollTop
            })
          }, 10)
        } else {
          this.setData({
            innerScrollTop: calScrollTop
          })
        }
      }
      return newVal
    },
    // 提供给开发者使用的接口
    boundingClientRect: function(idx) {
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
    getIndexesInViewport: function(inViewportPx) {
      inViewportPx || (inViewportPx = 1)
      const scrollTop = this.currentScrollTop
      let minTop = scrollTop + inViewportPx
      if (minTop < 0) minTop = 0
      let maxTop = scrollTop + this.data.height - inViewportPx
      if (maxTop > this.totalHeight) maxTop = this.totalHeight
      const indexes = []
      for (let i = 0; i < this.sizeArray.length; i++) {
        if (this.sizeArray[i].beforeHeight + this.sizeArray[i].height >= minTop && this.sizeArray[i].beforeHeight <= maxTop) {
          indexes.push(i)
        }
        if (this.sizeArray[i].beforeHeight > maxTop) break
      }
      return indexes
    },
    setUseInPage: function(useInPage) {
      this.useInPage = useInPage;
    },
    setPlaceholderImage: function(svgs, size) {
      const fill = "style='fill:rgb(204,204,204);'"
      const placeholderImages = [`data:image/svg+xml,%3Csvg height='${size.height}' width='${size.width}' xmlns='http://www.w3.org/2000/svg'%3E`]
      svgs.forEach(svg => {
        placeholderImages.push(`%3Crect width='${svg.width}' x='${svg.left}' height='${svg.height}' y='${svg.top}' ${fill} /%3E`)
      });
      placeholderImages.push("%3C/svg%3E");
      this.setData({
        placeholderImageStr: placeholderImages.join('')
      })
    }
  }
})
