import { collection, Firestore, getDocs, QuerySnapshot} from "firebase/firestore";

export async function fetchScoutedData(firestore: Firestore) : Promise<QuerySnapshot>{
    const querySnapshot = await getDocs(collection(firestore, "matches"));
    return querySnapshot;
}