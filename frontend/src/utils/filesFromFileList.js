/**
 * @param {FileList | null | undefined} fileList
 * @returns {File[]}
 */
export function filesFromFileList(fileList) {
  if (!fileList || fileList.length === 0) return [];
  return Array.from(fileList);
}
