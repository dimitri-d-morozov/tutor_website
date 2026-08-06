export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      course_topics: {
        Row: {
          course_id: string
          planned_lessons: number
          position: number
          topic_id: string
        }
        Insert: {
          course_id: string
          planned_lessons?: number
          position?: number
          topic_id: string
        }
        Update: {
          course_id?: string
          planned_lessons?: number
          position?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["exam_type"]
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["exam_type"]
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["exam_type"]
          title?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_size: number | null
          id: string
          levels: Database["public"]["Enums"]["exam_type"][]
          section_id: string | null
          storage_path: string | null
          title: string
          topic_id: string | null
          type: Database["public"]["Enums"]["material_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          section_id?: string | null
          storage_path?: string | null
          title: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["material_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          section_id?: string | null
          storage_path?: string | null
          title?: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["material_type"]
        }
        Relationships: [
          {
            foreignKeyName: "materials_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          explanation: string | null
          id: string
          levels: Database["public"]["Enums"]["exam_type"][]
          max_points: number
          options: Json | null
          section_id: string | null
          text: string
          topic_id: string | null
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          explanation?: string | null
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          max_points?: number
          options?: Json | null
          section_id?: string | null
          text: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          explanation?: string | null
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          max_points?: number
          options?: Json | null
          section_id?: string | null
          text?: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          id: string
          position: number
          title: string
        }
        Insert: {
          id?: string
          position?: number
          title: string
        }
        Update: {
          id?: string
          position?: number
          title?: string
        }
        Relationships: []
      }
      student_answers: {
        Row: {
          attempt_id: string
          created_at: string
          given_answer: Json | null
          id: string
          is_correct: boolean | null
          points: number | null
          question_id: string
          reviewed_at: string | null
          tutor_comment: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          given_answer?: Json | null
          id?: string
          is_correct?: boolean | null
          points?: number | null
          question_id: string
          reviewed_at?: string | null
          tutor_comment?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          given_answer?: Json | null
          id?: string
          is_correct?: boolean | null
          points?: number | null
          question_id?: string
          reviewed_at?: string | null
          tutor_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempt_questions"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "student_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "student_test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "attempt_questions"
            referencedColumns: ["question_id"]
          },
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lesson_materials: {
        Row: {
          material_id: string
          position: number
          role: Database["public"]["Enums"]["lesson_material_role"]
          student_lesson_id: string
        }
        Insert: {
          material_id: string
          position?: number
          role?: Database["public"]["Enums"]["lesson_material_role"]
          student_lesson_id: string
        }
        Update: {
          material_id?: string
          position?: number
          role?: Database["public"]["Enums"]["lesson_material_role"]
          student_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lesson_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lesson_materials_student_lesson_id_fkey"
            columns: ["student_lesson_id"]
            isOneToOne: false
            referencedRelation: "student_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lesson_tests: {
        Row: {
          position: number
          student_lesson_id: string
          test_template_id: string
        }
        Insert: {
          position?: number
          student_lesson_id: string
          test_template_id: string
        }
        Update: {
          position?: number
          student_lesson_id?: string
          test_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lesson_tests_student_lesson_id_fkey"
            columns: ["student_lesson_id"]
            isOneToOne: false
            referencedRelation: "student_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lesson_tests_test_template_id_fkey"
            columns: ["test_template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lessons: {
        Row: {
          created_at: string
          id: string
          meeting_url: string | null
          position: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["lesson_status"]
          student_id: string
          title: string | null
          topic_id: string | null
          tutor_note: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_url?: string | null
          position?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id: string
          title?: string | null
          topic_id?: string | null
          tutor_note?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meeting_url?: string | null
          position?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id?: string
          title?: string | null
          topic_id?: string | null
          tutor_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          course_id: string | null
          created_at: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          grade: string | null
          messenger: string | null
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          profile_id: string
          status: string
          tariff: string | null
          tutor_note: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          grade?: string | null
          messenger?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          profile_id: string
          status?: string
          tariff?: string | null
          tutor_note?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          grade?: string | null
          messenger?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          profile_id?: string
          status?: string
          tariff?: string | null
          tutor_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_test_attempts: {
        Row: {
          finished_at: string | null
          id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          student_lesson_id: string | null
          test_template_id: string | null
          total: number | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          student_lesson_id?: string | null
          test_template_id?: string | null
          total?: number | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          student_lesson_id?: string | null
          test_template_id?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_test_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_test_attempts_student_lesson_id_fkey"
            columns: ["student_lesson_id"]
            isOneToOne: false
            referencedRelation: "student_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_test_attempts_test_template_id_fkey"
            columns: ["test_template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      test_template_questions: {
        Row: {
          position: number
          question_id: string
          test_template_id: string
        }
        Insert: {
          position?: number
          question_id: string
          test_template_id: string
        }
        Update: {
          position?: number
          question_id?: string
          test_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_template_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "attempt_questions"
            referencedColumns: ["question_id"]
          },
          {
            foreignKeyName: "test_template_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_template_questions_test_template_id_fkey"
            columns: ["test_template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      test_templates: {
        Row: {
          created_at: string
          id: string
          levels: Database["public"]["Enums"]["exam_type"][]
          section_id: string | null
          time_limit_min: number | null
          title: string
          topic_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          section_id?: string | null
          time_limit_min?: number | null
          title: string
          topic_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          section_id?: string | null
          time_limit_min?: number | null
          title?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_templates_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_templates_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_materials: {
        Row: {
          material_id: string
          position: number
          role: Database["public"]["Enums"]["lesson_material_role"]
          topic_id: string
        }
        Insert: {
          material_id: string
          position?: number
          role?: Database["public"]["Enums"]["lesson_material_role"]
          topic_id: string
        }
        Update: {
          material_id?: string
          position?: number
          role?: Database["public"]["Enums"]["lesson_material_role"]
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_materials_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_tests: {
        Row: {
          position: number
          test_template_id: string
          topic_id: string
        }
        Insert: {
          position?: number
          test_template_id: string
          topic_id: string
        }
        Update: {
          position?: number
          test_template_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_tests_test_template_id_fkey"
            columns: ["test_template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_tests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          code: string | null
          id: string
          levels: Database["public"]["Enums"]["exam_type"][]
          position: number
          section_id: string | null
          title: string
        }
        Insert: {
          code?: string | null
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          position?: number
          section_id?: string | null
          title: string
        }
        Update: {
          code?: string | null
          id?: string
          levels?: Database["public"]["Enums"]["exam_type"][]
          position?: number
          section_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      attempt_questions: {
        Row: {
          answer_id: string | null
          attempt_id: string | null
          explanation: string | null
          given_answer: Json | null
          is_correct: boolean | null
          max_points: number | null
          options: Json | null
          points: number | null
          position: number | null
          question_id: string | null
          reviewed_at: string | null
          section_id: string | null
          student_id: string | null
          text: string | null
          topic_id: string | null
          tutor_comment: string | null
          type: Database["public"]["Enums"]["question_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_test_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_topic_progress: {
        Row: {
          earned_points: number | null
          max_points: number | null
          percent: number | null
          student_id: string | null
          topic_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_test_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      finish_attempt: { Args: { p_attempt: string }; Returns: undefined }
      generate_plan_for_student: {
        Args: {
          p_course: string
          p_interval_days?: number
          p_start?: string
          p_student: string
        }
        Returns: number
      }
      import_test: { Args: { payload: Json }; Returns: string }
      is_tutor: { Args: never; Returns: boolean }
      review_answer: {
        Args: { p_answer: string; p_comment?: string; p_points: number }
        Returns: undefined
      }
      save_answer: {
        Args: { p_answer: Json; p_attempt: string; p_question: string }
        Returns: undefined
      }
      start_attempt: {
        Args: { p_student_lesson?: string; p_test: string }
        Returns: string
      }
    }
    Enums: {
      attempt_status: "in_progress" | "completed" | "pending_review"
      exam_type: "ege" | "oge" | "olympiad"
      lesson_material_role: "presentation" | "extra"
      lesson_status: "upcoming" | "completed"
      material_type:
        | "presentation"
        | "textbook"
        | "video"
        | "homework"
        | "other"
      question_type: "single_choice" | "open"
      user_role: "student" | "tutor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attempt_status: ["in_progress", "completed", "pending_review"],
      exam_type: ["ege", "oge", "olympiad"],
      lesson_material_role: ["presentation", "extra"],
      lesson_status: ["upcoming", "completed"],
      material_type: ["presentation", "textbook", "video", "homework", "other"],
      question_type: ["single_choice", "open"],
      user_role: ["student", "tutor"],
    },
  },
} as const

