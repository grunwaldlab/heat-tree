---
title: heatTree Function
---

# heatTree Function

<a name="heatTree"></a>

## heatTree(containerSelector, treesInput, options) ⇒ <code>Object</code>
Create a heat tree visualization

**Kind**: global function  
**Returns**: <code>Object</code> - Object containing references to tree components  

| Param | Type | Description |
| --- | --- | --- |
| containerSelector | <code>string</code> | CSS selector for container element (required if first arg is config object) |
| treesInput | <code>Array</code> \| <code>Object</code> | Array of tree objects, each with tree, name, and metadata (optional) |
| options | <code>Object</code> | Configuration options |


* [heatTree(containerSelector, treesInput, options)](#heatTree) ⇒ <code>Object</code>
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


