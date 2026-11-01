export function recognitionProblem(floor){
 if(!floor.recognition)return null;
 const unread=floor.recognition.coverage?.complete===false?Math.max(1,floor.recognition.coverage.total-floor.recognition.coverage.read):0;
 const open=floor.pendingSpaces?.length||0;
 const unsupported=(floor.walls||[]).filter(w=>!w.recognition?.reviewed&&w.recognition?.sourceCheck&&(w.recognition.sourceCheck.coverage<.55||w.recognition.sourceCheck.missingPixels>30)).length;
 if(!unread&&!open&&!unsupported&&floor.walls?.length)return null;
 return {unread,open,unsupported,message:[unread?unread+' unread regions':'',open?open+' spaces with open boundaries':'',unsupported?unsupported+' walls without enough drawing evidence':'',!floor.walls?.length?'No architectural walls resolved':''].filter(Boolean).join(' · ')};
}
