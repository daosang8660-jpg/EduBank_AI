import type { NextApiRequest, NextApiResponse } from "next";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
){

    try{

        const docRef = await addDoc(
            collection(db,"questions"),
            {

                question:"Đây là câu hỏi đầu tiên",

                answer:"A",

                createdAt:new Date()

            }
        );

        res.status(200).json({

            success:true,

            id:docRef.id

        });

    }catch(err){

        console.log(err);

        res.status(500).json({

            success:false

        });

    }

}