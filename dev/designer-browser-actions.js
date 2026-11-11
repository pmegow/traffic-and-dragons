// Follow the visible File route; older-page fixtures keep their original buttons.
async function designerFileOpen(page){
 if(await page.locator('#designer-file').count()&&!await page.evaluate(()=>document.getElementById('designer-file').open))await page.locator('#designer-file-toggle').click();
}
exports.designerFileOpen=designerFileOpen;
exports.designerFileClick=async function(page,id){await designerFileOpen(page);await page.locator('#'+id).click();};
