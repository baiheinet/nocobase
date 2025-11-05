# L7Map 重构 TODO

## 已完成 ✅

- [x] 创建适配器基础架构 (BaseMapAdapter, IMapAdapter, MapAdapterFactory)
- [x] 实现 MapboxAdapter
- [x] 创建统一的 L7MapComponent
- [x] 创建统一的 L7MapBlock
- [x] 创建 Draw hook（原 useL7Draw，支持 point/lineString/polygon/circle）
- [x] 统一 Search 组件
- [x] Mapbox 地图基本功能
- [x] 编辑模式绘制功能
- [x] 只读模式显示功能

## 待完成 Mapbox 优化 🚧

- [ ] 优化 fitBounds 延迟时机（当前使用固定延迟，应该监听 map 加载完成事件）
- [ ] 添加地图加载状态指示器
- [ ] 测试所有绘制类型（point, lineString, polygon, circle）
- [ ] 测试 Block 模式的数据筛选功能
- [ ] 测试搜索功能
- [ ] 性能优化：大量数据点的渲染

## 待适配 AMap 🔜

**问题：** Scene 初始化时 `newScene.on` 方法不存在

**需要调查：**
- GaodeMap 返回的对象结构
- L7 Scene 如何正确初始化 GaodeMap
- 是否需要等待 GaodeMap 的特定事件

**参考旧代码：** `src/client/components/AMap/Map.tsx`

## 待适配 Google Maps 🔜

**问题：** 
1. L7 的 `Map` 类可能不支持 Google Maps
2. Google Maps Places API 已弃用 PlacesService

**需要调查：**
- 旧代码不使用 L7，直接使用原生 `google.maps.Map`
- 是否需要完全不同的实现方式（不使用 L7）
- 新的 Places API 迁移

**参考旧代码：** `src/client/components/GoogleMaps/Map.tsx`

## 配置页面简化 📝

- [ ] 统一三种地图的配置界面
- [ ] 移除重复的配置逻辑
- [ ] 添加地图类型选择说明

## 代码清理 🧹

**待删除的旧代码：**
- [ ] `src/client/components/AMap/` 文件夹
- [ ] `src/client/components/GoogleMaps/` 文件夹
- [x] `src/client/components/Mapbox/` 文件夹（已移除 Legacy 组件，统一使用 L7Map）

**预计删除：** ~3000 行代码

## 文档更新 📚

- [ ] 更新 REFACTORING.md
- [ ] 更新 MIGRATION.md
- [ ] 添加开发者文档
- [ ] 添加用户使用指南

## 测试计划 🧪

### Mapbox 测试
- [ ] 基础地图加载
- [ ] 点标记绘制和显示
- [ ] 线段绘制和显示
- [ ] 多边形绘制和显示
- [ ] 圆形绘制和显示
- [ ] Block 模式数据渲染
- [ ] Block 模式点击选择
- [ ] Block 模式框选
- [ ] POI 搜索
- [ ] 地图缩放控制
- [ ] 地图中心点设置
- [ ] fitBounds 自动适应

### AMap 测试（待实现后）
- [ ] 所有 Mapbox 测试项

### Google Maps 测试（待实现后）
- [ ] 所有 Mapbox 测试项

## 性能指标 📊

**代码量对比：**
- 旧实现：~4500 行（3个独立实现）
- 新实现：~1500 行（统一架构）
- 减少：66%

**维护性提升：**
- 单一入口点（L7MapComponent, L7MapBlock）
- 统一的绘制逻辑（Draw）
- 可扩展的适配器模式
- 类型安全（TypeScript）
