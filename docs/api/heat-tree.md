---
title: heatTree Function
---

# heatTree Function

<a name="heatTree"></a>

## heatTree(containerOrSelector, treesInput, options) ⇒ <code>Object</code>
Create a heat tree visualization

**Kind**: global function  
**Returns**: <code>Object</code> - Object containing references to tree components  

| Param | Type | Description |
| --- | --- | --- |
| containerOrSelector | <code>string</code> \| <code>HTMLElement</code> | CSS selector for container element or the element itself |
| treesInput | <code>Array</code> \| <code>Object</code> | Array of tree objects, each with tree, name, and metadata (optional) |
| options | <code>Object</code> | Configuration options |
| options.isolation | <code>string</code> | CSS isolation mode: 'shadow' (default) or 'none' |


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


