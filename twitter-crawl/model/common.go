package model

import (
	"time"

	"gorm.io/gorm"
)

type CommonEntity struct {
	// ↓ common ↓
	CreatedBy   uint           `gorm:"column:created_by;not null;default:0" json:"created_by"`
	UpdatedBy   uint           `gorm:"column:updated_by;not null;default:0" json:"updated_by"`
	PublishedAt time.Time      `gorm:"column:published_at;precision:6;default:null" json:"published_at"`
	CreatedAt   time.Time      `gorm:"column:created_at;precision:6;not null;default:CURRENT_TIMESTAMP(6)" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;precision:6;not null;default:CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;precision:6" json:"deleted_at"`
}
