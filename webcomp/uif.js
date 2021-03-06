// internal types ////////
// static data ///////////
const surroundTag = 'INNERHTML';
const standardTags = ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "dfn", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "isindex", "kbd", "keygen", "label", "legend", "li", "link", "listing", "map", "mark", "marquee", "menu", "meta", "meter", "nav", "nextid", "nobr", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "picture", "plaintext", "pre", "progress", "q", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr", "x-ms-webview", "xmp"]
    .reduce((sum, cur) => { sum[cur] = true; return sum; }, {});
const standardExtentions = ["html", "css", "js"];
const filesCache = new Map();
// Promisify so we can async/await //////
async function getFile(tag, ext) {
    const resource = "./components/" + tag + "." + ext;
    switch (ext) {
        case "js":
            return new Promise(resolve => {
                const script = document.createElement('script');
                script.src = resource;
                script.defer = true;
                script.onload = ev => resolve(ev);
                script.onerror = ev => resolve(undefined);
                document.head.appendChild(script);
            }).catch(_ => undefined).then(ev => console.log(tag + ".js", "loaded")).then(_ => resource);
        //const exported = await SystemJS.import(resource).catch(_ => undefined);
        //if (!exported) {
        //    console.error(tag + ".js should export a class");
        //    return undefined;
        //}
        //if (exported.default) return exported.default;
        //const validIdentifer = tag.replace(/-|\./g, '');
        //if (exported[validIdentifer]) return exported[validIdentifer];
        //console.error(tag + ".js should have an exported controller class.  Either the class is missing, isn't exported as the default, or isn't exported as", validIdentifer);
        //return undefined;
        case "css":
            return new Promise(resolve => {
                const link = document.createElement('link');
                link.href = resource;
                link.rel = "stylesheet";
                link.onload = ev => resolve(ev);
                link.onerror = ev => resolve(undefined);
                document.head.appendChild(link);
            }).catch(_ => undefined).then(ev => console.log(tag + ".css", "loaded")).then(_ => resource);
        case "html":
            return new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", resource);
                xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : "");
                xhr.send();
            });
        //case "css":
        //case "html":
        //    return new Promise<FileContents>(resolve => {
        //        const xhr = new XMLHttpRequest();
        //        xhr.open("GET", resource);
        //        xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : "");
        //        xhr.send();
        //    });
    }
    return undefined;
}
const browserToParseHTML = () => new Promise(r => setTimeout(r));
// scans the direct children of the passed-in HtmlElement for custom components. If any, recurses into them, and set the .children to what the recursion returns.
async function scanLoadAndInstantiate(parentElement) {
    const instantiating = [];
    for (let i = parentElement.children.length - 1; i >= 0; i--) {
        const element = parentElement.children[i];
        const tag = element.tagName.toLowerCase();
        if (standardTags[tag])
            scanLoadAndInstantiate(element); // check descendents of div, span, etc. but don't send them on to the next step; we don't memorize the children of a div even if they are custom components
        else
            instantiating.push(loadAndInstantiateComponent(tag, element)); // break this out into an async function so it doesn't block the for loop
    }
    return Promise.all(instantiating);
}
// as a separate async function, this won't block the for-loop above
async function loadAndInstantiateComponent(tag, element) {
    let definition = filesCache.get(tag);
    if (!definition) {
        definition = {};
        filesCache.set(tag, definition);
        const loadingFiles = standardExtentions.map(ext => getFile(tag, ext).then(fileContents => definition[ext] = fileContents));
        definition.loading = Promise.all(loadingFiles);
    }
    await definition.loading;
    const componentInstance = {
        definition: definition,
        element: element,
    };
    //    console.log(tag, definition);
    if (definition.html) {
        const template = document.createElement('template');
        template.innerHTML = definition.html;
        template.id = tag;
        document.body.appendChild(template);
        await browserToParseHTML();
        console.log(tag + ".html loaded");
    }
    if (definition.js) {
        try {
            element.controller = componentInstance.controller = new definition.js(componentInstance);
            console.log("element", element, "has controller", componentInstance.controller);
        }
        catch (e) {
            console.error(tag, "controller ctor threw", e);
        }
    }
    else
        console.log("no " + tag + ".js");
    return componentInstance;
}
// go ///////////
scanLoadAndInstantiate(document.body);
//# sourceMappingURL=uif.js.map