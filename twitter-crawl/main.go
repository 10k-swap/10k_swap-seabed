package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/0x60018/10k_swap-seabed/twitter-crawl/model"
	"github.com/joho/godotenv"
	twitterscraper "github.com/n0madic/twitter-scraper"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func connectDB() (db *gorm.DB) {
	DB_HOST := os.Getenv("DB_HOST")
	DB_NAME := os.Getenv("DB_NAME")
	DB_PORT := os.Getenv("DB_PORT")
	DB_USER := os.Getenv("DB_USER")
	DB_PASSWORD := os.Getenv("DB_PASSWORD")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)
	log.Println("dsn:", dsn)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err.Error())
	}

	// Migrate tables(Only Develop)
	PRODUCT_ENV := os.Getenv("PRODUCT_ENV")
	if strings.EqualFold(PRODUCT_ENV, "develop") {
		db.AutoMigrate(&model.TwitterCrawl{})
	}

	return db
}

func scan(tweetQuery string) {
	scraper := twitterscraper.New()
	scraper.SetSearchMode(twitterscraper.SearchLatest)

	for tweet := range scraper.SearchTweets(context.Background(), tweetQuery, 100) {
		if tweet.Error != nil {
			continue
		}

		result := core.db.Limit(1).Find(&model.TwitterCrawl{}, model.TwitterCrawl{TweetID: tweet.ID})
		if result.RowsAffected > 0 {
			continue
		}

		fmt.Println("tweet.ID", tweet.ID)

		twitterCrawl := model.TwitterCrawl{
			TweetID:   tweet.ID,
			UserID:    tweet.UserID,
			Username:  tweet.Username,
			TweetTime: time.Unix(tweet.Timestamp, 0),
			Content:   tweet.Text,
		}
		core.db.Create(&twitterCrawl)
	}
}

func tickerScan() {
	tweetQuery := os.Getenv("TWEET_QUERY")
	if tweetQuery == "" {
		fmt.Println("Miss env: [tweetQuery]")
		return
	}

	var scanTotal int64
	for {
		log.Println("scanTotal:", scanTotal)

		scan(tweetQuery)
		time.Sleep(time.Second * 5)

		scanTotal += 1
	}
}

func main() {
	godotenv.Load(fmt.Sprintf("..%c.env", os.PathSeparator))

	core.db = connectDB()

	tickerScan()
}
