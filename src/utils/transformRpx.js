let isIPhone = false
let deviceWidth
let deviceDPR
const BASE_DEVICE_WIDTH = 750
const checkDeviceWidth = () => {
  const info = wx.getSystemInfoSync()
  // console.log('info', info)
  isIPhone = info.platform === 'ios'
  const newDeviceWidth = info.screenWidth || 375
  const newDeviceDPR = info.pixelRatio || 2

  if (!isIPhone) {
    // HACK switch width and height when landscape
    // const newDeviceHeight = info.screenHeight || 375
    // 暂时不处理转屏的情况
  }

  if (newDeviceWidth !== deviceWidth || newDeviceDPR !== deviceDPR) {
    deviceWidth = newDeviceWidth
    deviceDPR = newDeviceDPR
    // console.info('Updated device width: ' + newDeviceWidth + 'px DPR ' + newDeviceDPR)
  }
}
checkDeviceWidth()

const eps = 1e-4
const transformByDPR = (number) => {
  if (number === 0) {
    return 0
  }
  number = number / BASE_DEVICE_WIDTH * deviceWidth
  number = Math.floor(number + eps)
  if (number === 0) {
    if (deviceDPR === 1 || !isIPhone) {
      return 1
    }
    return 0.5
  }
  return number
}

const rpxRE = /([+-]?\d+(?:\.\d+)?)rpx/gi
// const inlineRpxRE = /(?::|\s|\(|\/)([+-]?\d+(?:\.\d+)?)rpx/g

const transformRpx = (style, inline) => {
  if (typeof style !== 'string') {
    return style
  }
  const re = rpxRE
  return style.replace(re, function (match, num) {
    return transformByDPR(Number(num)) + (inline ? 'px' : '')
  })
}

module.exports = {
  transformRpx
}
