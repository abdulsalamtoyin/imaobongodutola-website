/* Registers a site-styled live preview for every CMS section. The markup lives
 * in preview-render.js (tested in Node); this file only wires it into Decap. */
(function () {
  "use strict";
  var R = window.PreviewRender;

  CMS.registerPreviewStyle("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,0..100,0..1;1,9..144,300..700,0..100,0..1&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap");
  CMS.registerPreviewStyle("/assets/css/style.css");
  CMS.registerPreviewStyle("/admin/preview.css");

  ["messages", "gallery", "books", "testimonies", "home", "contact"].forEach(function (name) {
    CMS.registerPreviewTemplate(name, createClass({
      render: function () {
        var data = this.props.entry.getIn(["data"]);
        var html = R[name](data ? data.toJS() : {}, R.resolver(this.props.getAsset));
        return h("div", { className: "pv", dangerouslySetInnerHTML: { __html: html } });
      },
    }));
  });
})();
