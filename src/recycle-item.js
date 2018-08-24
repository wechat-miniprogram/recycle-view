// components/recycle-item/recycle-item.js
Component({
  relations: {
    './recycle-view': {
      type: 'parent', // 关联的目标节点应为子节点
      linked() {}
    }
  },
  /**
   * 组件的属性列表
   */
  properties: {
  },

  /**
   * 组件的初始数据
   */
  data: {
    // height: 100
  },

  /**
   * 组件的方法列表
   */
  methods: {
    heightChange() {
    }
  }
})
