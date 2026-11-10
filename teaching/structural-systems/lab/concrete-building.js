/* Concrete Building withdrawn. Preserve saved records without loading a model. */
(function(W){
  'use strict';
  class ConcreteBuildingOffline {
    constructor(host,callbacks){this.host=host;this.cb=callbacks;this.state=W.ConcreteBuildingData.defaults();this.hide();}
    getData(){return structuredClone(this.state);}
    restore(raw){this.state=W.ConcreteBuildingData.normalize(raw);this.hide();}
    hide(){this.host.hidden=true;this.host.replaceChildren();}
    show(){this.hide();this.cb.toast('Concrete Building has been taken offline.');}
    openSource(){this.show();}
    render(){this.hide();}
    exportModel(){this.show();}
    context(){return null;}
  }
  W.ConcreteBuildingLab=ConcreteBuildingOffline;
})(window);
