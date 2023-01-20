import createNativeElement from './factory';
import * as vDOM from '../vdom/utils';
import { thunkInstantiate } from '../vdom/thunk';
import { setDomAttribute } from './attributes';
import { didMount } from '../vdom/lifecycle';
import { GLOBAL_CONTEXT, RENDER_CALLBACKS } from '../internal';
import _ from '../utils/index';

/**
 * Create a real DOM element from a virtual element, recursively looping down.
 * When it finds custom elements it will render them, cache them, and keep going,
 * so they are treated like any other native element.
 */

export function createDomElement(vnode, parentDOMElement)
{
    switch (vnode.type)
    {
        case 'text':
            return createTextNode(vnode, vnode.nodeValue);

        case 'empty':
            return createTextNode(vnode, '');

        case 'thunk':
            return flatten(createThunk(vnode, parentDOMElement));

        case 'fragment':
            return flatten(createFragment(vnode, parentDOMElement));

        case 'native':
            return flatten(createHTMLElement(vnode));
    }
}

function flatten(DOMElement)
{
    if (_.is_array(DOMElement))
    {
        let ret = [];

        _.foreach(DOMElement, function(i, child)
        {
            if (_.is_array(child))
            {
                _.array_merge(ret, flatten(child));
            }
            else
            {
                ret.push(child);
            }
        });

        return ret;
    }

    return DOMElement;
}

function createTextNode(vnode, text)
{
    let DOMElement = document.createTextNode(text);

    vDOM.nodeElem(vnode, DOMElement);

    return DOMElement;
}

function createHTMLElement(vnode)
{
    const thisContext = GLOBAL_CONTEXT.current;

    let { tagName, attributes, children, ref } = vnode;

    let DOMElement = createNativeElement(tagName);

    if (ref)
    {
        ref(DOMElement);
    }
    
    _.foreach(attributes, function(prop, value)
    {
        setDomAttribute(DOMElement, prop, value);
    });

    vDOM.nodeElem(vnode, DOMElement);

    _.foreach(children, function(i, child)
    {
        if (!_.is_empty(child))
        {
            let childDOMElem = createDomElement(child, DOMElement);

            // Returns a fragment
            if (_.is_array(childDOMElem))
            {
                appendFragment(DOMElement, childDOMElem);
            }
            else
            {
                DOMElement.appendChild(childDOMElem);
            }
        }
    });

    GLOBAL_CONTEXT.current = thisContext;

    return DOMElement;
}

/* Handles nested fragments */
function appendFragment(parentDOMElement, children)
{
    if (_.is_array(children))
    {
        _.foreach(children, function(i, child)
        {
            appendFragment(parentDOMElement, child);
        });
    }

    if (_.is_htmlElement(children))
    {
        parentDOMElement.appendChild(children);
    }
}

function createThunk(vnode, parentDOMElement)
{
    const thisContext = GLOBAL_CONTEXT.current;

    // Skip this it's already been rendered if it's coming from a patch
    if (vDOM.isThunkInstantiated(vnode))
    {
        let DOMElement = createDomElement(vnode.children[0]);

        return DOMElement;
    }

    let component = thunkInstantiate(vnode);
    
    // Create entire tree recursively
    let DOMElement = createDomElement(vnode.children[0]);

    // Point vnode
    vDOM.pointVnodeThunk(vnode, component);

    let _ref = vnode.ref;
    
    if (_ref)
    {
        _ref(DOMElement);
    }

    RENDER_CALLBACKS.current.push({callback: didMount, args: [component]});

    GLOBAL_CONTEXT.current = thisContext;

    return DOMElement;
}

function createFragment(vnode, parentDOMElement)
{
    let ret = [];

    _.foreach(vnode.children, function(i, child)
    {
        ret.push(createDomElement(child));
    });

    return ret;
}