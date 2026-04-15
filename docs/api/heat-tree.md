---
title: heatTree Function
---

# heatTree Function

<a name="heatTree"></a>

## heatTree(containerOrSelector, treesInput, options) ⇒ <code>Object</code>
Create a heat tree visualization

**Kind**: global function  
**Returns**: <code>Object</code> - Object containing references to tree components (including `shadowRoot` when using shadow isolation)

| Param | Type | Description |
| --- | --- | --- |
| containerOrSelector | <code>string</code> \| <code>HTMLElement</code> | CSS selector for container element or the element itself |
| treesInput | <code>Array</code> \| <code>Object</code> | Array of tree objects, each with tree, name, and metadata (optional) |
| options | <code>Object</code> | Configuration options |
| options.isolation | <code>string</code> | CSS isolation mode: `'shadow'` (default) or `'none'` |

### CSS Isolation

By default, the widget renders inside a [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) attached to the container element. This provides complete CSS isolation, preventing styles from the host page from affecting the widget and vice versa.

```javascript
// Default: Shadow DOM isolation (recommended)
heatTree('#container', treeData);

// Disable isolation (widget styles may interact with page styles)
heatTree('#container', treeData, { isolation: 'none' });
```

The returned object includes a `shadowRoot` property (or `null` when `isolation` is `'none'`):

```javascript
const result = heatTree('#container', treeData);
console.log(result.shadowRoot); // ShadowRoot instance
```

* [heatTree(containerOrSelector, treesInput, options)](#heatTree) ⇒ <code>Object</code>
    * [~addNewTree(treeName, treeString, metadataTables, metadataNames)](#heatTree..addNewTree) ⇒ <code>Array.&lt;string&gt;</code>
    * [~switchToTree(treeName)](#heatTree..switchToTree)

<a name="heatTree..addNewTree"></a>

### heatTree~addNewTree(treeName, treeString, metadataTables, metadataNames) ⇒ <code>Array.&lt;string&gt;</code>
Add a new tree to the visualization

**Kind**: inner method of [<code>heatTree</code>](#heatTree)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of unique names of trees added  

| Param | Type | Description |
| --- | --- | --- |
| treeName | <code>string</code> | Name for the new tree |
| treeString | <code>string</code> | Newick or NEXUS string for the tree(s) |
| metadataTables | <code>Array</code> | Optional array of metadata table strings |
| metadataNames | <code>Array</code> | Optional array of metadata table names |

<a name="heatTree..switchToTree"></a>

### heatTree~switchToTree(treeName)
Switch to a different tree

**Kind**: inner method of [<code>heatTree</code>](#heatTree)  

| Param | Type | Description |
| --- | --- | --- |
| treeName | <code>string</code> | Name of the tree to switch to |


