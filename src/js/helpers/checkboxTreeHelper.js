/**
  * checkboxTreeHelper.js
  * Created by Jonathan Hill 10/01/2019
**/
import { difference, cloneDeep } from 'lodash';

const getChildren = (node, keyMap) => {
    if (!node.children && keyMap.isParent(node)) {
        const value = node[keyMap.value]
            ? node[keyMap.value]
            : node.id || '';
        return {
            children: [{
                isPlaceHolder: true,
                label: 'Placeholder Child',
                value: `children_of_${value}`
            }]
        };
    }
    else if (node.children && node.children.length > 0) {
        return {
            children: node.children.map((child) => ({
                ...child,
                label: child[keyMap.label] || child.label || '',
                value: child[keyMap.value] || child.value || '',
                ...getChildren(child, keyMap)
            }))
        };
    }
    return {};
};

const getCountWithPlaceholderOffset = (key, codesUnderPlaceholder, nodes, traverseTreeByCodeFn) => {
    // when the placeholder is counted, adjust the count to offset for the 'nodes under this placeholder' which will be counted.
    const hasSelectedButNotCounted = codesUnderPlaceholder.some((obj) => obj.placeholder === key);

    if (hasSelectedButNotCounted) {
        const nodesUnderPlaceholder = codesUnderPlaceholder
            .filter((code) => code.placeholder === key);
        const aggregateOffsetOfNodesUnderPlaceholder = nodesUnderPlaceholder
            .map((obj) => traverseTreeByCodeFn(nodes, obj.code))
            .reduce((agg, nodeTobeCounted) => {
                if (nodeTobeCounted.count === 0) {
                    return agg + 1;
                }
                return agg + nodeTobeCounted.count;
            }, 0);

        return aggregateOffsetOfNodesUnderPlaceholder;
    }
    return 0;
};

export const removePlaceholderString = (str) => {
    if (str.includes('children_of_')) return str.split('children_of_')[1];
    return str;
};

export const getAllDescendants = (node) => {
    if (!node.children) return [node.value];
    return [
        ...node.children
            .reduce((acc, descendant) => ([...acc, ...getAllDescendants(descendant)]), [])
    ];
};

export const removeStagedFilter = (
    nodes,
    checkedNodes,
    removedNode,
    traverseTreeByCodeFn,
    getHighestAncestorFn,
    getImmediateAncestorFn
) => checkedNodes
    .filter((checked) => {
        const checkedNode = traverseTreeByCodeFn(nodes, removePlaceholderString(checked));
        if (getHighestAncestorFn(checkedNode) === removedNode) return false;
        if (getImmediateAncestorFn(checkedNode) === removedNode) return false;
        if (checkedNode.value === removedNode) return false;
        return true;
    });

export const getCountOfAllCheckedDescendants = (
    nodes,
    ancestorKey,
    checkedNodes,
    traverseTreeByCodeFn
) => checkedNodes
    .map((checked) => removePlaceholderString(checked))
    .filter((checkedNode) => checkedNode.includes(ancestorKey))
    .reduce((ancestorCount, checkedAncestor) => {
        const nodeCount = traverseTreeByCodeFn(nodes, checkedAncestor).count;
        if (nodeCount === 0) {
            return ancestorCount + 1;
        }
        return ancestorCount + nodeCount;
    }, 0);

const removeFromUnchecked = (
    checkedCode,
    unchecked,
    checked,
    nodes,
    traverseTreeByCodeFn,
    getImmediateAncestorFn,
    getHighestAncestorFn
) => {
    // we only want to remove from unchecked if...
    const key = checkedCode.includes('children_of_')
        ? checkedCode.split('children_of_')[1]
        : checkedCode;
    const currentNode = traverseTreeByCodeFn(nodes, key);
    const ancestorKey = getImmediateAncestorFn(currentNode);
    const parentKey = getHighestAncestorFn(currentNode);
    const parentNode = traverseTreeByCodeFn(nodes, parentKey);
    const ancestorNode = traverseTreeByCodeFn(nodes, ancestorKey);

    const uncheckedCodeToBeRemoved = unchecked
        .reduce((acc, uncheckedCode) => {
            if (uncheckedCode === checkedCode) {
                // (a) the unchecked array has the code/placeholder code we're currently checking.
                return checkedCode;
            }
            if (uncheckedCode === key) {
                // (a) applies here too.
                return key;
            }
            if (uncheckedCode === parentKey) {
                // (b) an ancestor of the code we're currently checking is in the unchecked array
                // AND the checked array has the other ancestors too.
                const sumOfCheckedDescendants = getCountOfAllCheckedDescendants(
                    nodes,
                    parentKey,
                    checked,
                    traverseTreeByCodeFn
                );
                if (sumOfCheckedDescendants === parentNode.count) {
                    return parentKey;
                }
            }

            if (uncheckedCode === ancestorKey) {
                // (b) applies here too
                const sumOfCheckedDescendants = getCountOfAllCheckedDescendants(
                    nodes,
                    ancestorKey,
                    checked,
                    traverseTreeByCodeFn
                );

                if (sumOfCheckedDescendants === ancestorNode.count) {
                    return ancestorKey;
                }
            }
            return acc;
        }, null);

    if (uncheckedCodeToBeRemoved) {
        return uncheckedCodeToBeRemoved;
    }
    return null;
};

export const decrementCountAndUpdateUnchecked = (
    uncheckedNode,
    unchecked,
    checked,
    counts,
    nodes,
    traverseTreeByCodeFn,
    getImmediateAncestorFn,
    getHighestAncestorFn
) => {
    const { value } = uncheckedNode;
    const nodeFromTree = traverseTreeByCodeFn(nodes, value);
    const parentKey = getHighestAncestorFn(nodeFromTree);
    const ancestorKey = getImmediateAncestorFn(nodeFromTree);
    const amountToDecrement = nodeFromTree.count > 0 ? nodeFromTree.count : 1;
    const shouldRemoveNode = counts.some((nodeFromCounts) => (
        !uncheckedNode.checked &&
        (
            (nodeFromCounts.value === value) ||
            (nodeFromCounts.count <= amountToDecrement && nodeFromCounts.value === parentKey)
        )
    ));
    let newCounts;
    if (shouldRemoveNode) {
        newCounts = counts.filter((nodeFromCounts) => nodeFromCounts.value !== parentKey);
    }
    else {
        newCounts = counts.map((nodeFromCounts) => {
            const newCount = nodeFromCounts.count - amountToDecrement;
            if (nodeFromCounts.value === parentKey) {
                return { ...nodeFromCounts, count: newCount };
            }
            return nodeFromCounts;
        });
    }
    // we only update the unchecked array if an ancestor of the unchecked node is checked
    const shouldUpdateUnchecked = (
        checked.includes(parentKey) ||
        checked.includes(`children_of_${parentKey}`) ||
        checked.includes(ancestorKey) ||
        checked.includes(`children_of_${ancestorKey}`)
    );

    const newUnchecked = shouldUpdateUnchecked
        ? [...unchecked, value]
        : unchecked;

    return [newCounts, newUnchecked];
};

// returns new counts array, newUnchecked array
export const incrementCountAndUpdateUnchecked = (
    newChecked,
    oldChecked,
    unchecked,
    nodes,
    currentCount,
    traverseTreeByCodeFn,
    getImmediateAncestorFn,
    getHighestAncestorFn
) => {
    const newlyChecked = difference(newChecked, oldChecked);
    const nodeTree = cloneDeep(nodes);

    // child place holders reflect the count of their immediate ancestor
    const placeHoldersToBeCounted = newChecked
        .filter((node) => node.includes('children_of_'));

    const codesUnderPlaceholder = [];
    const codesWithoutPlaceholder = [];
    const codesToBeRemovedFromUnchecked = [];

    newChecked
        .filter((code) => !code.includes('children_of_'))
        .forEach((code) => {
            const node = traverseTreeByCodeFn(nodeTree, code);
            const immediateAncestorCode = getImmediateAncestorFn(node);
            const highestAncestorCode = getHighestAncestorFn(node);
            if (placeHoldersToBeCounted.includes(`children_of_${immediateAncestorCode}`)) {
                codesUnderPlaceholder.push({ code, placeholder: immediateAncestorCode });
            }
            else if (placeHoldersToBeCounted.includes(`children_of_${highestAncestorCode}`)) {
                codesUnderPlaceholder.push({ code, placeholder: highestAncestorCode });
            }
            else if (placeHoldersToBeCounted.includes(`children_of_${code}`)) {
                codesUnderPlaceholder.push({ code, placeholder: code });
            }
            else {
                codesWithoutPlaceholder.push(code);
            }
        });

    const newCounts = [...new Set([...newlyChecked])]
        .reduce((newState, code) => {
            const isPlaceholder = code.includes('children_of_');
            const key = isPlaceholder
                ? code.split('children_of_')[1]
                : code;

            const currentNode = traverseTreeByCodeFn(nodeTree, key);
            const parentKey = getHighestAncestorFn(currentNode);
            const parentNode = traverseTreeByCodeFn(nodeTree, parentKey);

            // may need to remove this node or an ancestor node from the unchecked array
            const shouldCodeBeRemoved = removeFromUnchecked(
                code,
                unchecked,
                newChecked,
                nodeTree,
                traverseTreeByCodeFn,
                getImmediateAncestorFn,
                getHighestAncestorFn
            );
            if (shouldCodeBeRemoved) {
                codesToBeRemovedFromUnchecked.push(shouldCodeBeRemoved);
            }

            const indexInArray = newState.findIndex((node) => node.value === parentKey);
            const isParentInArray = indexInArray > -1;

            const offsetCount = getCountWithPlaceholderOffset(key, codesUnderPlaceholder, nodeTree, traverseTreeByCodeFn);
            const originalCount = currentNode.count === 0
                ? 1
                : currentNode.count;
            const amountToIncrement = originalCount - offsetCount;

            if (!isParentInArray) {
                newState.push({
                    label: parentNode.label,
                    value: parentNode.value,
                    count: amountToIncrement
                });
            }
            else if (isParentInArray) {
                // eslint-disable-next-line no-param-reassign
                newState[indexInArray].count += amountToIncrement;
            }
            if (isParentInArray && parentNode.count && parentNode.count < newState[indexInArray].count) {
                // eslint-disable-next-line no-param-reassign
                newState[indexInArray].count = parentNode.count;
            }
            else if (isParentInArray && newState[indexInArray].count < 1) {
                // eslint-disable-next-line no-param-reassign
                newState[indexInArray].count = 1;
            }
            return newState;
        }, [...currentCount]);
    return [
        newCounts,
        unchecked
            .filter((uncheckedNode) => {
                if (codesToBeRemovedFromUnchecked.includes(uncheckedNode)) {
                    return false;
                }
                return true;
            })
    ];
};

export const cleanTreeData = (nodes, keyMap) => nodes.map((node) => ({
    ...node,
    label: node[keyMap.label],
    value: node[keyMap.value],
    ...getChildren(node, keyMap)
}));


export const sortNodesByValue = (a, b) => {
    if (a.isPlaceHolder) return 1;
    if (b.isPlaceHolder) return -1;
    const nodeA = parseInt(a.value, 10);
    const nodeB = parseInt(b.value, 10);
    if (nodeA > nodeB) return 1;
    if (nodeB > nodeA) return -1;
    return 0;
};

export const expandAllNodes = (nodes, propForNode = 'value') => {
    const getValue = (acc, node) => {
        acc.push(node[propForNode]);
        if (node.children) {
            acc.push(
                ...node.children.reduce(getValue, [])
            );
        }
        return acc;
    };

    return nodes
        .reduce(getValue, []);
};

export const mergeChildren = (parentFromSearch, existingParent, traverseTreeByCodeFn) => {
    // 1. hide node not in search
    // 2. add placeholders if not there
    if (existingParent.children && parentFromSearch.children) {
        const existingChildArray = existingParent
            .children
            .filter((node) => {
                const childFromSearch = traverseTreeByCodeFn(parentFromSearch.children, node.value);
                if (node.isPlaceHolder && childFromSearch && childFromSearch.count === childFromSearch?.children?.length) {
                    return false;
                }
                return true;
            })
            .map((node) => ({ ...node, className: 'hide' }));

        const nodes = parentFromSearch.children
            .reduce((acc, searchChild) => {
                const existingChildIndex = acc
                    .findIndex((existingChild) => existingChild.value === searchChild.value);

                if (existingChildIndex !== -1) {
                    // show this child
                    const existingChild = acc[existingChildIndex];
                    existingChild.className = '';
                    if (existingChild.children) {
                        // hide this child's children
                        existingChild.children = existingChild.children.map((grand) => ({ ...grand, className: 'hide' }));
                    }

                    if (existingChild.children && searchChild.children) {
                        searchChild.children
                            .forEach((searchGrandChild) => {
                                const existingGrandChildIndex = existingChild.children
                                    .findIndex((existingGC) => existingGC.value === searchGrandChild.value);

                                if (existingGrandChildIndex !== -1) {
                                    // unless it's in the search array
                                    const existingGrandChild = existingChild.children[existingGrandChildIndex];
                                    existingGrandChild.className = '';
                                    const isParent = (
                                        Object.keys(existingGrandChild).includes('children') &&
                                        existingGrandChild?.children?.length
                                    );
                                    if (isParent) {
                                        existingGrandChild.children = existingGrandChild.children.map((greatGrand) => {
                                            const greatGrandIsInSearchResults = searchGrandChild.children
                                                .some((nodeFromSearch) => nodeFromSearch.value === greatGrand.value);
                                            if (greatGrandIsInSearchResults) return { ...greatGrand, className: '' };
                                            return { ...greatGrand, className: 'hide' };
                                        });
                                    }
                                }
                                else {
                                    // or we're adding a new node.
                                    acc[existingChildIndex].children.push(searchGrandChild);
                                }
                            });
                    }
                    return acc;
                }
                // child added via search
                if (searchChild.count && searchChild.count === searchChild?.children?.length) {
                    acc.push(searchChild);
                }
                else {
                    const childrenFromSearch = searchChild.children ? searchChild.children : [];
                    acc.push({
                        ...searchChild,
                        children: [
                            ...childrenFromSearch,
                            {
                                isPlaceHolder: true,
                                label: "Child Placeholder",
                                value: `children_of_${searchChild.value}`,
                                className: 'hide'
                            }
                        ]
                    });
                }


                return acc;
            }, existingChildArray);

        return nodes;
    }
    else if (existingParent.children && !parentFromSearch.children) {
        return existingParent.children.map((child) => ({ ...child, className: 'hide' }));
    }
    else if (!existingParent.children && parentFromSearch.children && parentFromSearch.children.length !== parentFromSearch.count) {
        return [
            ...parentFromSearch.children,
            {
                className: 'hide',
                isPlaceHolder: true,
                label: 'Placeholder Child',
                value: `children_of_${parentFromSearch.value}`
            }
        ];
    }
    return [];
};

export const addSearchResultsToTree = (
    tree,
    searchResults,
    traverseTreeByCodeFn,
    sortNodes = sortNodesByValue
) => {
    const nodesFromSearchToBeReplaced = searchResults.map((node) => node.value);
    return tree
        .map((existingNode) => {
            // nodeKey is naicsCode!
            const nodeKey = existingNode.value;
            if (nodesFromSearchToBeReplaced.includes(nodeKey)) {
                const nodeFromSearch = searchResults.find((node) => node.value === nodeKey);
                return {
                    ...nodeFromSearch,
                    children: [...mergeChildren(nodeFromSearch, existingNode, traverseTreeByCodeFn)]
                };
            }
            return { ...existingNode, className: 'hide' };
        })
        .sort(sortNodes);
};

export const populateBranchOrLeafLevelNodes = (
    tree,
    key = '',
    newNodes = [],
    getHighestAncestorCode,
    traverseTreeByCodeFn
) => {
    // 1. add nodes to either branch or leaf level of tree
    // 2. when adding nodes, don't remove placeholders if we're adding a partial child and don't remove any existing children
    const nodeWithNewChildren = key ? traverseTreeByCodeFn(tree, key) : '';
    const highestAncestorCode = nodeWithNewChildren
        ? getHighestAncestorCode(nodeWithNewChildren)
        : getHighestAncestorCode(key);
    return tree.map((node) => {
        const [data] = newNodes;
        const shouldPopulateBranch = node.value === key;
        const shouldPopulateLeaves = node.value === highestAncestorCode;
        if (shouldPopulateBranch) {
            // we're populating an immediate descendant of the top-tier parent; AKA a "branch".
            return {
                ...node,
                children: data.children
                    .map((child) => {
                        const existingChild = node.children.find((olderChild) => olderChild.value === child.value);
                        const weHaveTheGrandChildren = (
                            existingChild &&
                            existingChild?.children.length === child.count &&
                            !existingChild?.children.some((existingGrand) => existingGrand?.isPlaceHolder)
                        );
                        const weHaveAtLeastOneGrandChild = (
                            existingChild &&
                            existingChild?.children.filter((grand) => !grand.isPlaceHolder).length > 0
                        );
                        if (weHaveTheGrandChildren) {
                            return {
                                ...child,
                                children: existingChild.children
                                    .map((grand) => ({ ...grand, className: '' }))
                                    .sort(sortNodesByValue)
                            };
                        }
                        if (weHaveAtLeastOneGrandChild) {
                            return {
                                ...child,
                                children: [
                                    ...child.children,
                                    ...existingChild.children.filter((grand) => (!grand.isPlaceHolder))
                                ].sort(sortNodesByValue)
                            };
                        }
                        return child;
                    }).sort(sortNodesByValue)
            };
        }
        if (shouldPopulateLeaves) {
            // we're adding grandchildren to an existing branch.
            return {
                ...node,
                className: '',
                children: node.children
                    ? node.children
                        .map((child) => {
                            if (child.value === key) {
                                const isPopulated = (
                                    child.children.length === child.count &&
                                    !child.children.some((grandChild) => grandChild.isPlaceHolder)
                                );
                                if (isPopulated) {
                                    // we already have the child data for this particular child, don't overwrite it w/ a placeholder.
                                    return child;
                                }
                                return {
                                    ...child,
                                    children: data.children
                                };
                            }
                            const isParent = Object.keys(child).includes('children');
                            if (isParent) {
                                return {
                                    ...child,
                                    children: child.children.map((grand) => {
                                        if (grand.value === key) {
                                            return {
                                                // populating great grand children; only happens w/ PSC
                                                ...grand,
                                                children: data.children
                                            };
                                        }
                                        return grand;
                                    })
                                };
                            }
                            return child;
                        })
                    : []
            };
        }
        const shouldAddNewBranchToTree = (
            key &&
            data &&
            node.value === highestAncestorCode &&
            !node.children.some((child) => child.value === key)
        );
        if (shouldAddNewBranchToTree) {
            // top-tier parent only has a placeholder child and we're adding this branch on the fly from a url-hash.
            return {
                ...node,
                className: '',
                children: [
                    // leave the placeholder b/c we're only adding one child!
                    ...node.children,
                    data
                ]
            };
        }
        return node;
    });
};

export const autoCheckImmediateChildrenAfterDynamicExpand = (
    parentNode,
    checked,
    unchecked,
    keyForCode,
    shouldNodeHaveChildren
) => {
    const value = parentNode[keyForCode];
    // deselect placeholder values for node!
    const removeParentPlaceholders = checked
        .filter((code) => !code.includes(`children_of_${value}`));

    const newValues = parentNode
        .children
        // does unchecked have placeholders...?
        .filter((child) => !unchecked.includes(child[keyForCode]))
        .map((child) => {
            // at child level, check all grand children w/ the placeholder
            const willNodeHavePlaceholderChildren = (
                (
                    !Object.keys(child).includes('children') ||
                    !child?.children?.length ||
                    child?.children.some((grand) => grand.isPlaceHolder)
                ) &&
                shouldNodeHaveChildren(child)
            );
            if (willNodeHavePlaceholderChildren) {
                return `children_of_${child[keyForCode]}`;
            }
            return child[keyForCode];
        });

    return [...new Set([...removeParentPlaceholders, ...newValues])];
};

export const showAllNodes = (tree) => tree
    .map((node) => ({
        ...node,
        className: '',
        children: node.children
            ? node.children
                .map((child) => {
                    if (child.children && child.children.some((grand) => grand.className === 'hide')) {
                        return {
                            ...child,
                            className: '',
                            children: child.children.map((grand) => ({ ...grand, className: '' }))
                        };
                    }
                    return {
                        ...child,
                        className: ''
                    };
                })
                .sort(sortNodesByValue)
            : []
    }));

export const setNodes = (key, nodes, treeName, cleanNodesFn) => ({
    type: `SET_${treeName}_NODES`,
    key,
    payload: cleanNodesFn(nodes)
});

export const showTree = (treeName) => ({
    type: `SHOW_${treeName}_TREE`
});

export const setExpanded = (expanded, type = 'SET_EXPANDED', treeName) => ({
    type: `${type}_${treeName}`,
    payload: expanded
});

export const addChecked = (nodeValue, treeName) => ({
    type: `ADD_CHECKED_${treeName}`,
    payload: nodeValue
});

export const setChecked = (nodes, treeName) => ({
    type: `SET_CHECKED_${treeName}`,
    payload: nodes
});

export const setUnchecked = (nodes, treeName) => ({
    type: `SET_UNCHECKED_${treeName}`,
    payload: nodes
});

export const setSearchedNodes = (nodes, treeName, cleanNodesFn) => ({
    type: `SET_SEARCHED_${treeName}`,
    payload: cleanNodesFn(nodes)
});

export const setCounts = (newCounts, treeName) => ({
    type: `SET_${treeName}_COUNTS`,
    payload: newCounts
});
