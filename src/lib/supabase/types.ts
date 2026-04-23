export type UserRole = "student" | "teacher" | "admin";
export type TeacherStatus = "pending" | "approved" | "rejected";
export type JoinRequestStatus = "pending" | "approved" | "rejected";
export type SubmissionStatus = "graded" | "ungraded" | "in_progress";
export type QuestionType =
  | "mcq"
  | "checkbox"
  | "dropdown"
  | "identification"
  | "enumeration"
  | "matching"
  | "essay";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: UserRole;
          teacher_status: TeacherStatus;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          teacher_status?: TeacherStatus;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: UserRole;
          teacher_status?: TeacherStatus;
          created_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          teacher_id: string;
          year_level: string | null;
          strand: string | null;
          course: string | null;
          class_password: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          teacher_id: string;
          year_level?: string | null;
          strand?: string | null;
          course?: string | null;
          class_password?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          year_level?: string | null;
          strand?: string | null;
          course?: string | null;
          class_password?: string | null;
        };
      };
      class_join_requests: {
        Row: {
          id: string;
          class_id: string;
          student_id: string;
          student_name: string | null;
          student_role: UserRole | null;
          requested_role: "student" | "teacher" | null;
          status: JoinRequestStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          student_id: string;
          student_name?: string | null;
          student_role?: UserRole | null;
          requested_role?: "student" | "teacher" | null;
          status?: JoinRequestStatus;
          created_at?: string;
        };
        Update: {
          student_name?: string | null;
          student_role?: UserRole | null;
          requested_role?: "student" | "teacher" | null;
          status?: JoinRequestStatus;
        };
      };
      class_students: {
        Row: {
          id: string;
          class_id: string;
          student_id: string;
          student_name: string | null;
          member_role: "student" | "teacher" | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          student_id: string;
          student_name?: string | null;
          member_role?: "student" | "teacher" | null;
          joined_at?: string;
        };
        Update: {
          class_id?: string;
          student_id?: string;
          student_name?: string | null;
          member_role?: "student" | "teacher" | null;
        };
      };
      terms: {
        Row: {
          id: string;
          class_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
        };
      };
      quizzes: {
        Row: {
          id: string;
          class_id: string;
          term_id: string;
          title: string;
          duration: number | null;
          total_score: number;
          allow_auto_score: boolean;
          allow_review: boolean;
          opens_at: string | null;
          closes_at: string | null;
          quiz_password: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          term_id: string;
          title: string;
          duration?: number | null;
          total_score?: number;
          allow_auto_score?: boolean;
          allow_review?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
          quiz_password?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          duration?: number | null;
          total_score?: number;
          allow_auto_score?: boolean;
          allow_review?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
          quiz_password?: string | null;
          created_by?: string | null;
        };
      };
      questions: {
        Row: {
          id: string;
          quiz_id: string;
          type: QuestionType;
          content: string | null;
          options: Json | null;
          correct_answer: string | null;
          image_url: string | null;
          required: boolean;
          option_feedback: Json | null;
          points: number;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          type: QuestionType;
          content?: string | null;
          options?: Json | null;
          correct_answer?: string | null;
          image_url?: string | null;
          required?: boolean;
          option_feedback?: Json | null;
          points?: number;
        };
        Update: {
          type?: QuestionType;
          content?: string | null;
          options?: Json | null;
          correct_answer?: string | null;
          image_url?: string | null;
          required?: boolean;
          option_feedback?: Json | null;
          points?: number;
        };
      };
      submissions: {
        Row: {
          id: string;
          quiz_id: string;
          student_id: string;
          answers: Json | null;
          score: number;
          status: SubmissionStatus;
          started_at: string | null;
          remaining_seconds: number | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          student_id: string;
          answers?: Json | null;
          score?: number;
          status?: SubmissionStatus;
          started_at?: string | null;
          remaining_seconds?: number | null;
          submitted_at?: string;
        };
        Update: {
          answers?: Json | null;
          score?: number;
          status?: SubmissionStatus;
          started_at?: string | null;
          remaining_seconds?: number | null;
          submitted_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          class_id: string;
          content: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          content?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string | null;
          created_by?: string | null;
        };
      };
    };
    Views: {
      student_scores: {
        Row: {
          student_id: string;
          class_id: string;
          term: string;
          term_total: number;
        };
      };
    };
  };
}
