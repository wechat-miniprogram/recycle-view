# recycle-view

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

## 代码目录结构

长列表组件在 DEMO 里面的 recycle-view 文件夹内。长列表代码由2个自定义组件 recycle-view、recycle-item 和一组 API 组成，对应的代码结构如下

```yaml
├── recycle-view/
    └── recycle-view/
    └── recycle-item/
    └── index.js
```

recycle-view 目录下的结构详细描述如下：

| 目录/文件          | 描述                     |
| ----------------- | ------------------------ |
| recycle-view 目录 | 长列表组件目录             |
| recycle-item 目录 | 长列表每一项 item 组件目录 |
| index.js          | 提供操作长列表数据的API    |

## 使用方法

1. 把整个长列表的目录 recycle-view 引入到小程序项目中。

2. 在页面的 json 配置文件中添加 recycle-view 和 recycle-item 自定义组件的配置

   ```json
   {
     "usingComponents": {
       "recycle-view": "/recycle-view/recycle-view/recycle-view",
       "recycle-item": "/recycle-view/recycle-item/recycle-item"
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
   | scroll-to-index       | Number  | 否   | 设置滚动到长列表的项                      |
   | scroll-with-animation | Boolean | 否   | 默认为false，同scroll-view的同名字段      |
   | lower-threshold       | Number  | 否   | 默认为false，同scroll-view同名字段        |
   | upper-threshold       | Number  | 否   | 默认为false，同scroll-view同名字段        |
   | bindscroll            | 事件    | 否   | 同scroll-view同名字段                     |
   | bindscrolltolower     | 事件    | 否   | 同scroll-view同名字段                     |
   | bindscrolltoupper     | 事件    | 否   | 同scroll-view同名字段                     |

   **recycle-view 包含3个 slot，具体介绍如下：**

   | 名称      | 描述                                                   |
   | --------- | ------------------------------------------------------ |
   | before    | 默认 slot 的前面的非回收区域                             |
   | 默认 slot | 长列表的列表展示区域，recycle-item 必须定义在默认 slot 中  |
   | after     | 默认 slot 的后面的非回收区域                             |

   ​  长列表的内容实际是在一个 scroll-view 滚动区域里面的，当长列表里面的内容，不止是单独的一个列表的时候，例如我们页面底部都会有一个 copyright 的声明，我们就可以把这部分的内容放在 before 和 after 这2个 slot 里面。

   **recycle-item 的介绍如下：**

   ​  需要注意的是，recycle-item 中必须定义 wx:for 列表循环，不应该通过 setData 来设置 wx:for 绑定的变量，而是通过`createRecycleContext`方法创建`RecycleContext`对象来管理数据，`createRecycleContext`在 index.js 文件里面定义。建议同时设置 wx:key，以提升列表的渲染性能。

4. 页面 JS 管理 recycle-view 的数据

   ```javascript
   const createRecycleContext = require('../../functional-components/recycle-view/index.js')
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
           ctx.appendList(newList)
           // ctx.updateList(beginIndex, list)
           // ctx.deleteList(beginIndex, count)
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

   ​  页面必须通过 Component 构造器定义，页面引入了`recycle-view/index.js`文件之后，会在 wx 对象下面新增接口`createRecycleContext`函数创建`RecycleContext`对象来管理 recycle-view 定义的的数据，`createRecycleContext`接收类型为1个 Object 的参数，Object 参数的每一个 key 的介绍如下：

   | 参数名    | 类型            | 描述                                                             |
   | -------- | --------------- | --------------------------------------------------------------- |
   | id       | String          | 对应 recycle-view 的 id 属性的值                                  |
   | dataKey  | String          | 对应 recycle-item 的 wx:for 属性设置的绑定变量名                   |
   | page     | Page/Component  | recycle-view 所在的页面或者组件的实例，页面或者组件内可以直接传 this |
   | itemSize | Object/Function | 此参数用来生成 recycle-item 的宽和高，前面提到过，要知道当前需要渲染哪些 item，必须知道 item 的宽高才能进行计算<br />Object 必须包含{ width, height }两个属性，Function 的话接收 item, index 这2个参数，返回一个包含{ width, height }的 Object |

   RecycleContext 对象提供的方法有：

   | 方法                  | 参数                          | 说明                                                                                   |
   | --------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
   | appendList            | list, callback               | 在当前的长列表数据上追加 list 数据，callback 是渲染完成的回调函数                           |
   | append                | list, callback               | 同 append 函数                                                                          |
   | splice                | begin, count, list, callback | 新增/删除长列表数据，参数同 Array 的[splice](http://www.w3school.com.cn/js/jsref_splice.asp)函数，可用来替代 deleteList 和 updateList 这2个操作，callback 是渲染完成的回调函数 |
   | deleteList            | begin, count, callback       | 删除长列表数据，begin 是开始删除的数据下标，count 是删除的数量，callback 是渲染完成的回调函数 |
   | updateList            | begin, list, callback        | 更新长列表数据。begin 是开始更新的数据下标，list 是新的列表数据，callback 是渲染完成的回调函数 |
   | destroy               | 无                           | 销毁 RecycleContext 对象，在 recycle-view 销毁的时候调用此方法                             |
   | forceUpdate           | callback, reinitSlot         | 重新渲染 recycle-view。callback 是渲染完成的回调函数，当 before 和 after 这2个 slot 的高度发生变化时候调用此函数，reinitSlot 设置为 true。当 item 的宽高发生变化的时候也可以调用此方法。 |
   | getBoundingClientRect | index                        | 获取某个数据项的在长列表中的位置，返回{ left, top, width, height }的 Object。                |
   | getScrollTop          | 无                           | 获取长列表的当前的滚动位置。                                                                |

   ## Tips

   1. recycle-view 设置 batch 属性的值必须为{{batchSetRecycleData}}。
   2. `createRecycleContext(options)`的id参数必须和 recycle-view 的 id 属性一致，dataKey 参数必须和 recycle-item 的 wx:for 绑定的变量名一致。
   3. 不要通过 setData 设置 recycle-item 的 wx:for 的变量值，建议 recycle-item 设置 wx:key 属性。
   4. 页面JS必须定义 recycle-view 中的 item-size 属性指定的函数，该函数对于同一行的 recycle-item，返回的高度必须一样。另外，该函数返回的宽和高必须和 recycle-item 的真实宽高一致，这样显示才正常。
   5. 如果长列表里面包含图片，必须保证图片资源是有 HTTP 缓存的，否则在滚动过程中会发起很多的图片请求。
   6. 有些数据不一定会渲染出来，使用 wx.createSelectorQuery 的时候有可能会失效，可使用 RecycleContext 的 getBoundingClientRect 来替代。

