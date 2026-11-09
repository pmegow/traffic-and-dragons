// Exit props share one identity transform and one owner, independent of their animation kind.
import { Group } from 'three';
export function exitScope(view, die) {
  const group = new Group();
  group.name = 'Die exit effects';
  group.userData.dieOwner = die;
  view.scene.add(group);
  const scopedView = Object.create(view);
  scopedView.scene = group;
  return { group, view: scopedView, dispose: () => group.removeFromParent() };
}
