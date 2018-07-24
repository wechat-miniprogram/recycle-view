const RecycleContext = require('./utils/recycle-context.js')
const recycleViewportChangeFunc = require('./utils/viewport-change-func')

const RecycleBehavior = Behavior({
  // 这个在behavior里面定义
  properties: {
  },
  methods: {
    createRecycleContext: function (options) {
      if (!options.page) {
        options.page = this
      }
      return new RecycleContext(options)
    },
    _recycleViewportChange: recycleViewportChangeFunc
  }
})
module.exports = RecycleBehavior