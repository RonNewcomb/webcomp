export default class PersonDetails extends HTMLElement {
    constructor() {
        super();
        console.log("person-details ctor");
        const template = document.getElementById('person-template');
        const templateContent = template.content;
        const shadowRoot = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
        div { padding: 10px; border: 1px solid gray; width: 200px; margin: 10px; }
        h2 { margin: 0 0 10px; }
        ul { margin: 0; }
        p { margin: 10px 0; }
      `;
        shadowRoot.appendChild(style);
        shadowRoot.appendChild(templateContent.cloneNode(true));
    }
}
customElements.define('person-details', PersonDetails);
//# sourceMappingURL=person-details.js.map