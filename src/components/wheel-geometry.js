export const wrap=(value,count)=>((value%count)+count)%count;
export function wheelWindow(center,count) {
 if(!count)return [];
 return [...new Set(Array.from({length:Math.min(count,7)},(_,slot)=>wrap(center-Math.min(3,Math.floor(count/2))+slot,count)))];
}
export function wheelDistance(index,position,count) {
 let distance=wrap(index-position,count);if(distance>count/2)distance-=count;return distance;
}
export function wheelPose(distance,width,height) {
 // Angular pitch is unchanged: growing the library never tightens the cover gaps.
 const radius=Math.min(width*.9,height*1.7),angle=distance*(width<600?.45:.38);
 const x=radius*Math.sin(angle),y=radius*(1-Math.cos(angle));
 const centerY=height*(width<=640?.48:.43)+y;
 const edge=Math.max(0,Math.min(1,(2.65-Math.abs(distance))/.5));
 const lower=Math.max(0,Math.min(1,(height*.97-centerY)/(height*.18)));
 return {x,y,angle,opacity:Math.min(edge,lower)};
}
