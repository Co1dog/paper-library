import {GitHubLibrary} from './upload-core.js?v=cloud-fast-20261105-v4';
export const githubClient=new GitHubLibrary();
const events=new EventTarget();
export function onGitHubConnection(fn){events.addEventListener('change',fn);return ()=>events.removeEventListener('change',fn);}
export async function connectGitHub(token){await githubClient.connect(token);events.dispatchEvent(new Event('change'));}
export function disconnectGitHub(){githubClient.disconnect();events.dispatchEvent(new Event('change'));}
