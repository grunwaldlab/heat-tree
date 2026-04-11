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
| treesInput | <code>Array</code> \| <code>Object</code> | Array of tree objects, each with newick, name, and metadata (optional) |
| options | <code>Object</code> | Configuration options |


* [heatTree(containerSelector, treesInput, options)](#heatTree) ⇒ <code>Object</code>
    * [~addNewTree(treeName, newickStr, metadataTables, metadataNames)](#heatTree..addNewTree)
    * [~switchToTree(treeName)](#heatTree..switchToTree)

<a name="heatTree..addNewTree"></a>

### heatTree~addNewTree(treeName, newickStr, metadataTables, metadataNames)
Add a new tree to the visualization

**Kind**: inner method of [<code>heatTree</code>](#heatTree)  

| Param | Type | Description |
| --- | --- | --- |
| treeName | <code>string</code> | Name for the new tree |
| newickStr | <code>string</code> | Newick string for the tree |
| metadataTables | <code>Array</code> | Optional array of metadata table strings |
| metadataNames | <code>Array</code> | Optional array of metadata table names |

<a name="heatTree..switchToTree"></a>

### heatTree~switchToTree(treeName)
Switch to a different tree

**Kind**: inner method of [<code>heatTree</code>](#heatTree)  

| Param | Type | Description |
| --- | --- | --- |
| treeName | <code>string</code> | Name of the tree to switch to |


