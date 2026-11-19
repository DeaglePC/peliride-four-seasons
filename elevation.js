// A raised-cosine summit meets flat ground with zero slope at both ends.
const peaks=[[75,660,12],[380,840,6],[2030,2550,8],[3040,3630,23],[3350,3760,9]];
export function roadHeight(distance){
 let height=0;
 for(const [start,end,rise] of peaks){
  if(distance>start&&distance<end)height+=rise*(1-Math.cos((distance-start)/(end-start)*2*Math.PI))*.5;
 }
 return height;
}
export function grade(distance){return (roadHeight(distance+1)-roadHeight(distance-1))*.5}
