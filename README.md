# recycle-view

小程序自定义组件

> 使用此组件需要依赖小程序基础库 2.2.2 版本，同时依赖开发者工具的 npm 构建。具体详情可查阅[官方 npm 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html)。

## 背景

​ 电商小程序往往需要展示很多商品，当一个页面展示很多的商品信息的时候，会造成小程序页面的卡顿以及白屏。原因有如下几点：

1. 商品列表数据很大，首次 setData 的时候耗时高
2. 渲染出来的商品列表 DOM 结构多，每次 setData 都需要创建新的虚拟树、和旧树 diff 操作耗时都比较高
3. 渲染出来的商品列表 DOM 结构多，占用的内存高，造成页面被系统回收的概率变大。

因此实现长列表组件来解决这些问题。

## 实现思路

​ 核心的思路就是只渲染显示在屏幕的数据，基本实现就是监听 scroll 事件，并且重新计算需要渲染的数据，不需要渲染的数据留一个空的 div 占位元素。

​ 假设列表数据有100个 item，知道了滚动的位置，怎么知道哪些 item 必须显示在页面？因为 item 还没渲染出来，不能通过 getComputedStyle 等 DOM 操作得到每个 item 的位置，所以无法知道哪些 item 需要渲染。为了解决这个问题，需要每个 item 固定宽高。item 的宽高的定义见下面的 API 的`createRecycleContext()`的参数 itemSize 的介绍。

​ 滚动过程中，重新渲染数据的同时，需要设置当前数据的前后的 div 占位元素高度，同时是指在同一个渲染周期内。页面渲染是通过 setData 触发的，列表数据和 div 占位高度在2个组件内进行 setData 的，为了把这2个 setData 放在同一个渲染周期，用了一个 hack 方法，所以定义 recycle-view 的 batch 属性固定为`batch="{{batchSetRecycleData}}"`。

​ 在滚动过程中，为了避免频繁出现白屏，会多渲染当前屏幕的前后2个屏幕的内容。

## 包结构

长列表组件由2个自定义组件 recycle-view、recycle-item 和一组 API 组成，对应的代码结构如下

```yaml
├── miniprogram-recycle-view/
    └── recycle-view 组件
    └── recycle-item 组件
    └── index.js
```

包结构详细描述如下：

| 目录/文件          | 描述                     |
| ----------------- | ------------------------ |
| recycle-view 组件 | 长列表组件                |
| recycle-item 组件 | 长列表每一项 item 组件     |
| index.js          | 提供操作长列表数据的API    |

## 使用方法

1. 安装组件

```
npm install --save miniprogram-recycle-view
```

2. 在页面的 json 配置文件中添加 recycle-view 和 recycle-item 自定义组件的配置

   ```json
   {
     "usingComponents": {
       "recycle-view": "miniprogram-recycle-view/recycle-view",
       "recycle-item": "miniprogram-recycle-view/recycle-item"
     }
   }
   ```

3. WXML 文件中引用 recycle-view

   ```xml
   <recycle-view batch="{{batchSetRecycleData}}" id="recycleId">
     <view slot="before">长列表前面的内容</view>
     <recycle-item wx:for="{{recycleList}}" wx:key="id">
       <view>
           <image style='width:80px;height:80px;float:left;' src="{{item.image_url}}"></image>
         {{item.idx+1}}. {{item.title}}
       </view>
     </recycle-item>
     <view slot="after">长列表后面的内容</view>
   </recycle-view>
   ```

   **recycle-view 的属性介绍如下：**

   | 字段名                | 类型    | 必填 | 描述                                      |
   | --------------------- | ------- | ---- | ----------------------------------------- |
   | id                    | String  | 是   | id必须是页面唯一的字符串                  |
   | batch                 | Boolean | 是   | 必须设置为{{batchSetRecycleData}}才能生效 |
   | height                | Number  | 否   | 设置recycle-view的高度，默认为页面高度    |
   | width                 | Number  | 否   | 设置recycle-view的宽度，默认是页面的宽度  |
   | enable-back-to-top    | Boolean | 否   | 默认为false，同scroll-view同名字段        |
   | scroll-top            | Number  | 否   | 默认为false，同scroll-view同名字段        |
   | scroll-y              | Number  | 否   | 默认为true，同scroll-view同名字段        |
   | scroll-to-index       | Number  | 否   | 设置滚动到长列表的项                      |
   | placeholder-image     | String  | 否   | 默认占位背景图片，在渲染不及时的时候显示，不建议使用大图作为占位。建议传入SVG的Base64格式，可使用[工具](https://codepen.io/jakob-e/pen/doMoML)将SVG代码转为Base64格式。支持SVG中设置rpx。 |
   | scroll-with-animation | Boolean | 否   | 默认为false，同scroll-view的同名字段      |
   | lower-threshold       | Number  | 否   | 默认为false，同scroll-view同名字段        |
   | upper-threshold       | Number  | 否   | 默认为false，同scroll-view同名字段        |
   | bindscroll            | 事件    | 否   | 同scroll-view同名字段                     |
   | bindscrolltolower     | 事件    | 否   | 同scroll-view同名字段                     |
   | bindscrolltoupper     | 事件    | 否   | 同scroll-view同名字段                     |

   **recycle-view 包含3个 slot，具体介绍如下：**

   | 名称      | 描述                                                      |
   | --------- | --------------------------------------------------------- |
   | before    | 默认 slot 的前面的非回收区域                              |
   | 默认 slot | 长列表的列表展示区域，recycle-item 必须定义在默认 slot 中 |
   | after     | 默认 slot 的后面的非回收区域                              |

   ​  长列表的内容实际是在一个 scroll-view 滚动区域里面的，当长列表里面的内容，不止是单独的一个列表的时候，例如我们页面底部都会有一个 copyright 的声明，我们就可以把这部分的内容放在 before 和 after 这2个 slot 里面。

   **recycle-item 的介绍如下：**

   ​  需要注意的是，recycle-item 中必须定义 wx:for 列表循环，不应该通过 setData 来设置 wx:for 绑定的变量，而是通过`createRecycleContext`方法创建`RecycleContext`对象来管理数据，`createRecycleContext`在 index.js 文件里面定义。建议同时设置 wx:key，以提升列表的渲染性能。

4. 页面 JS 管理 recycle-view 的数据

   ```javascript
   const createRecycleContext = require('miniprogram-recycle-view')
   Page({
       onReady: function() {
           var ctx = createRecycleContext({
             id: 'recycleId',
             dataKey: 'recycleList',
             page: this,
             itemSize: { // 这个参数也可以直接传下面定义的this.itemSizeFunc函数
               width: 162,
               height: 182
             }
           })
           ctx.append(newList)
           // ctx.update(beginIndex, list)
           // ctx.destroy()
       },
       itemSizeFunc: function (item, idx) {
           return {
               width: 162,
               height: 182
           }
       }
   })
   ```

   `typescript`支持,使用如下方式引入
   ```typescript
   import * as createRecycleContext from 'miniprogram-recycle-view';
   ```

   ​  页面必须通过 Component 构造器定义，页面引入了`miniprogram-recycle-view`包之后，会在 wx 对象下面新增接口`createRecycleContext`函数创建`RecycleContext`对象来管理 recycle-view 定义的的数据，`createRecycleContext`接收类型为1个 Object 的参数，Object 参数的每一个 key 的介绍如下：

   | 参数名    | 类型            | 描述                                                             |
   | -------- | --------------- | --------------------------------------------------------------- |
   | id       | String          | 对应 recycle-view 的 id 属性的值                                  |
   | dataKey  | String          | 对应 recycle-item 的 wx:for 属性设置的绑定变量名                   |
   | page     | Page/Component  | recycle-view 所在的页面或者组件的实例，页面或者组件内可以直接传 this |
   | itemSize | Object/Function | 此参数用来生成recycle-item的宽和高，前面提到过，要知道当前需要渲染哪些item，必须知道item的宽高才能进行计算<br />Object必须包含{width, height}两个属性，Function的话接收item, index这2个参数，返回一个包含{width, height}的Object<br />itemSize如果是函数，函数里面`this`指向RecycleContext<br />如果样式使用了rpx，可以通过transformRpx来转化为px。<br />为Object类型的时候，还有另外一种用法，详细情况见下面的itemSize章节的介绍。 |
   | useInPage | Boolean | 是否整个页面只有recycle-view。Page的定义里面必须至少加空的onPageScroll函数，主要是用在页面级别的长列表，并且需要用到onPullDownRefresh的效果。切必须设置`root`参数为当前页面对象 |
   | root | Page | 当前页面对象，可以通过getCurrentPages获取, 当useInPage为true必须提供 |

   RecycleContext 对象提供的方法有：

   | 方法                  | 参数                         | 说明                                                         |
   | --------------------- | ---------------------------- | ------------------------------------------------------------ |
   | append                | list, callback               | 在当前的长列表数据上追加list数据，callback是渲染完成的回调函数 |
   | splice                | begin, count, list, callback | 插入/删除长列表数据，参数同Array的[splice](http://www.w3school.com.cn/js/jsref_splice.asp)函数，callback是渲染完成的回调函数 |
   | update                | begin, list, callback        | 更新长列表的数据，从索引参数begin开始，更新为参数list，参数callback同splice。 |
   | destroy               | 无                           | 销毁RecycleContext对象，在recycle-view销毁的时候调用此方法   |
   | forceUpdate           | callback, reinitSlot         | 重新渲染recycle-view。callback是渲染完成的回调函数，当before和after这2个slot的高度发生变化时候调用此函数，reinitSlot设置为true。当item的宽高发生变化的时候也需要调用此方法。 |
   | getBoundingClientRect | index                        | 获取某个数据项的在长列表中的位置，返回{left, top, width, height}的Object。 |
   | getScrollTop          | 无                           | 获取长列表的当前的滚动位置。                                 |
   | transformRpx          | rpx                          | 将rpx转化为px，返回转化后的px整数。itemSize返回的宽高单位是px，可以在这里调用此函数将rpx转化为px，参数是Number，例如ctx.transformRpx(140)，返回70。注意，transformRpx会进行四舍五入，所以transformRpx(20) + transformRpx(90)不一定等于transformRpx(110) |
   | getViewportItems      | inViewportPx                 | 获取在视窗内的数据项，用于判断某个项是否出现在视窗内。用于曝光数据上报，菜品和类别的联动效果实现。参数inViewportPx表示距离屏幕多少像素为出现在屏幕内，可以为负值。 |
    | getList      |       无          | 获取到完整的数据列表 |

   ## itemSize使用

   itemSize可以为包含{width, height}的Object，所有数据只有一种宽高信息。如果有多种，则可以提供一个函数，长列表组件会调用这个函数生成每条数据的宽高信息，如下所示：

   ```javascript
   function(item, index) {
       return {
           width: 195,
           height: item.azFirst ? 130 : 120
       }
   }
   ```

   

   ## Tips

   1. recycle-view设置batch属性的值必须为{{batchSetRecycleData}}。
   2. recycle-item的宽高必须和itemSize设置的宽高一致，否则会出现跳动的bug。
   3. recycle-view设置的高度必须和其style里面设置的样式一致。
   4. `createRecycleContext(options)`的id参数必须和recycle-view的id属性一致，dataKey参数必须和recycle-item的wx:for绑定的变量名一致。
   5. 不能在recycle-item里面使用wx:for的index变量作为索引值的，请使用{{item.\_\_index\_\_}}替代。
   6. 不要通过setData设置recycle-item的wx:for的变量值，建议recycle-item设置wx:key属性。
   7. 如果长列表里面包含图片，必须保证图片资源是有HTTP缓存的，否则在滚动过程中会发起很多的图片请求。
   8. 有些数据不一定会渲染出来，使用wx.createSelectorQuery的时候有可能会失效，可使用RecycleContext的getBoundingClientRect来替代。
   9. 当使用了useInPage参数的时候，必须在Page里面定义onPageScroll事件。
  10. transformRpx会进行四舍五入，所以`transformRpx(20) + transformRpx(90)`不一定等于`transformRpx(110)`
  11. 如果一个页面有多个长列表，必须多设置batch-key属性，每个的batch-key的值和batch属性的变量必须不一致。例如
  ```html
  <recycle-view batch="{{batchSetRecycleData}}" batch-key="batchSetRecycleData"></recycle-view>
  <recycle-view batch="{{batchSetRecycleData1}}" batch-key="batchSetRecycleData1"></recycle-view>
  ```