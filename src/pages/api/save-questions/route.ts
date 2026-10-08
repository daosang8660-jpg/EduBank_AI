import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(_req:NextApiRequest,res:NextApiResponse){
 return res.status(410).json({success:false,message:"Endpoint cũ đã ngừng sử dụng. Hãy gọi POST /api/save-questions có token đăng nhập."});
}
