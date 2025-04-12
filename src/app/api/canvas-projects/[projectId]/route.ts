import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canvasProjects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { CanvasData } from "@/types/canvas";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const project = await db
      .select()
      .from(canvasProjects)
      .where(
        and(
          eq(canvasProjects.id, params.projectId),
          eq(canvasProjects.userId, session.user.id)
        )
      )
      .limit(1);

    if (!project[0]) {
      return new NextResponse("Project not found", { status: 404 });
    }

    return NextResponse.json(project[0]);
  } catch (error) {
    console.error("[CANVAS_PROJECT_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, canvasData } = body;

    // Create default canvas data
    const defaultCanvasData: CanvasData = {
      version: "1.0",
      pages: [],
      currentPage: 0,
      complete_doors_and_windows: [],
      single_doors: [],
      double_doors: [],
      windows: [],
      single_doors_and_windows: [],
      single_doors_and_double_doors: [],
      double_doors_and_windows: [],
      wall_color_processing: [], // Added for Walls Detection feature
      room_area_processing: [], // Added for Room Area Detection feature
    };

    // Merge with provided data if it exists
    const finalCanvasData: CanvasData = canvasData 
      ? {
          ...defaultCanvasData,
          ...canvasData,
          pages: canvasData.pages || defaultCanvasData.pages,
          currentPage: canvasData.currentPage || defaultCanvasData.currentPage,
          version: canvasData.version || defaultCanvasData.version,
          complete_doors_and_windows: canvasData.complete_doors_and_windows || [],
          single_doors: canvasData.single_doors || [],
          double_doors: canvasData.double_doors || [],
          windows: canvasData.windows || [],
          single_doors_and_windows: canvasData.single_doors_and_windows || [],
          single_doors_and_double_doors: canvasData.single_doors_and_double_doors || [],
          double_doors_and_windows: canvasData.double_doors_and_windows || [],
        } 
      : defaultCanvasData;

    const updatedProject = await db
      .update(canvasProjects)
      .set({
        name: name,
        canvasData: {
          version: finalCanvasData.version,
          pages: finalCanvasData.pages,
          currentPage: finalCanvasData.currentPage,
          totalChunks: finalCanvasData.totalChunks,
          chunkIndex: finalCanvasData.chunkIndex,
          projectId: finalCanvasData.projectId,
          complete_doors_and_windows: finalCanvasData.complete_doors_and_windows,
          single_doors: finalCanvasData.single_doors,
          double_doors: finalCanvasData.double_doors,
          windows: finalCanvasData.windows,
          single_doors_and_windows: finalCanvasData.single_doors_and_windows,
          single_doors_and_double_doors: finalCanvasData.single_doors_and_double_doors,
          double_doors_and_windows: finalCanvasData.double_doors_and_windows,
          wall_color_processing: finalCanvasData.wall_color_processing,
          room_area_processing: finalCanvasData.room_area_processing
        }
      })
      .where(
        and(
          eq(canvasProjects.id, params.projectId),
          eq(canvasProjects.userId, session.user.id)
        )
      )
      .returning();

    if (!updatedProject[0]) {
      return new NextResponse("Project not found", { status: 404 });
    }

    return NextResponse.json(updatedProject[0]);
  } catch (error) {
    console.error("[CANVAS_PROJECT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await db
      .delete(canvasProjects)
      .where(
        and(
          eq(canvasProjects.id, params.projectId),
          eq(canvasProjects.userId, session.user.id)
        )
      );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[CANVAS_PROJECT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
