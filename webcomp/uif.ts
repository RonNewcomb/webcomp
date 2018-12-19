
// internal types ////////

interface TagName extends String { }
interface FileContents extends String { }
interface FileExtension extends String { }
interface ControllerCtor {
    new(instance?: ComponentInstance): Controller;
}
interface Controller extends Object, ControllerCtor {
}

type ElementWithController = Element & { controller?: Controller };

interface ComponentDefinition {
    css: FileContents | undefined;
    html: FileContents | undefined;
    js: ControllerCtor | undefined;
    loading?: Promise<(FileContents | undefined)[]>;
}

interface ComponentInstance {
    definition: ComponentDefinition;
    element: ElementWithController;
    children?: ComponentInstance[]; // basically @ViewChildren(), so only custom components which are direct children of this custom component
    controller?: Controller;
}

export interface EventHandler {
    (/*...rest:any[],*/ event: Event, element: Element): void;
}

// static data ///////////

const surroundTag = 'INNERHTML';
const standardTags = ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "dfn", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "isindex", "kbd", "keygen", "label", "legend", "li", "link", "listing", "map", "mark", "marquee", "menu", "meta", "meter", "nav", "nextid", "nobr", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "picture", "plaintext", "pre", "progress", "q", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr", "x-ms-webview", "xmp"]
    .reduce((sum, cur) => { sum[cur] = true; return sum; }, <{ [key: string]: boolean }>{});
const standardExtentions: (keyof ComponentDefinition)[] = ["html", "css", "js"];
const filesCache = new Map<TagName, ComponentDefinition>();

// Promisify so we can async/await //////

async function getFile(tag: TagName, ext: FileExtension): Promise<FileContents | undefined> {
    const resource = "./components/" + tag + "." + ext;
    switch (ext) {
        case "js":
            const exported = await SystemJS.import(resource).catch(_ => undefined);
            console.log("exported", exported);
            if (!exported) return undefined;
            if (exported.default) return exported.default;
            const validIdentifer = tag.replace(/-|\./g, '');
            if (exported[validIdentifer]) return exported[validIdentifer];
            console.error(tag + ".js should have an exported controller class.  Either the class is missing, isn't exported as the default, or isn't exported as", validIdentifer);
            return undefined;
        case "css":
        case "html":
            return Promise.resolve(resource);
        //case "css":
        //case "html":
        //    return new Promise<FileContents>(resolve => {
        //        const xhr = new XMLHttpRequest();
        //        xhr.open("GET", resource);
        //        xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : "");
        //        xhr.send();
        //    });
    }
}

const browserToParseHTML = () => new Promise(r => setTimeout(r));

// scans the direct children of the passed-in HtmlElement for custom components. If any, recurses into them, and set the .children to what the recursion returns.
async function scanLoadAndInstantiate(parentElement: Element): Promise<ComponentInstance[]> {
    const instantiating: Promise<ComponentInstance>[] = [];
    for (let i = parentElement.children.length - 1; i >= 0; i--) {
        const element: ElementWithController = parentElement.children[i];
        const tag: TagName = element.tagName.toLowerCase();

        if (standardTags[tag as string])
            scanLoadAndInstantiate(element); // check descendents of div, span, etc. but don't send them on to the next step; we don't memorize the children of a div even if they are custom components
        else
            instantiating.push(loadAndInstantiateComponent(tag, element)); // break this out into an async function so it doesn't block the for loop
    }
    return Promise.all(instantiating);
}

// as a separate async function, this won't block the for-loop above
async function loadAndInstantiateComponent(tag: TagName, element: ElementWithController): Promise<ComponentInstance> {
    let definition: ComponentDefinition | undefined = filesCache.get(tag);

    if (!definition) {
        definition = {} as ComponentDefinition;
        filesCache.set(tag, definition);
        const loadingFiles = standardExtentions.map(ext => getFile(tag, ext).then(fileContents => (<any>definition)[ext as string] = fileContents));
        definition.loading = Promise.all(loadingFiles);
    }

    if (definition.loading)
        await definition.loading;

    const componentInstance: ComponentInstance = {
        definition: definition,
        element: element,
    };

    if (definition.css) {
        // <link rel="stylesheet" href="fonts.css">
        await new Promise(resolve => {
            const link = document.createElement('link') as HTMLLinkElement;
            link.href = definition!.css as string;
            link.rel = "stylesheet";
            link.onload = ev => resolve(ev);
            document.head!.appendChild(link);
        }).then(ev => console.log(tag + ".css", "loaded", ev));
    }

    if (definition.html) {
        // <link rel="import" href="/path/to/imports/stuff.html">
        await new Promise(resolve => {
            const link = document.createElement('link') as HTMLLinkElement;
            link.href = definition!.html as string;
            link.rel = "import";
            link.onload = ev => resolve(ev);
            document.body.appendChild(link);
        }).then(ev => console.log(tag + ".html", "loaded:", ev));

        //const oldContent = element.innerHTML;
        //element.innerHTML = definition.html as string;

        //if (oldContent) {
        //    await browserToParseHTML();
        //    const placeContentHeres = element.getElementsByTagName(surroundTag);
        //    for (let i = placeContentHeres.length - 1; i >= 0; i--)
        //        placeContentHeres[i].outerHTML = oldContent;
        //}

        await browserToParseHTML();
        componentInstance.children = await scanLoadAndInstantiate(element);
    }

    console.log(definition);

    if (definition.js) {
        try {
            element.controller = componentInstance.controller = new definition.js(componentInstance);
            console.log("element", element, "has controller", componentInstance.controller);
        }
        catch (e) {
            console.error(tag, "controller ctor threw", e);
        }
    }

    return componentInstance;
}

// go ///////////

scanLoadAndInstantiate(document.body);
