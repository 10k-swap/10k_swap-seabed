package main

import "gorm.io/gorm"

type Core struct {
	db *gorm.DB
}

var core Core
