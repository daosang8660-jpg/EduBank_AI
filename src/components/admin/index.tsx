import { useState } from "react";

import AdminLayout from "@/components/admin/AdminLayout";

import GradeManager from "@/components/admin/GradeManager";

import SubjectManager from "@/components/admin/SubjectManager";

import type { MenuType } from "@/components/admin/Sidebar";
import TextbookImport from "@/components/curriculum/TextbookImport";

import ChapterManager from "@/components/admin/ChapterManager";

import LessonManager from "@/components/admin/LessonManager";

export default function AdminPage(){

    const [active,setActive]=useState<MenuType>("classes");

    return(

        <AdminLayout

            active={active}

            setActive={setActive}

        >

            {active==="classes"&&(

                <GradeManager/>

            )}

            {active==="subjects"&&(

                <SubjectManager/>

            )}

            {active==="books"&&(

                <TextbookImport/>

            )}

            {active==="chapters"&&(

                <ChapterManager/>

            )}

            {active==="lessons"&&(

                <LessonManager/>

            )}

        </AdminLayout>

    )

}