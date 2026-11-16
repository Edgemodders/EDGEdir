// The views EDGEdir registers, in the order package.json lists them under its activity bar
// container. A unit test checks the two agree.

/** The view ids, as package.json's `contributes.views.edgedir` names them. */
export const VIEWS = ["edgedir.desk", "edgedir.library", "edgedir.animations"] as const;
