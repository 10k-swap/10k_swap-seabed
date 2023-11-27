package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/0x60018/10k_swap-seabed/twitter-crawl/model"
	"github.com/joho/godotenv"
	twitterscraper "github.com/n0madic/twitter-scraper"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func connectDB() (db *gorm.DB) {
	TZ := os.Getenv("TZ")
	DB_HOST := os.Getenv("DB_HOST")
	DB_NAME := os.Getenv("DB_NAME")
	DB_PORT := os.Getenv("DB_PORT")
	DB_USER := os.Getenv("DB_USER")
	DB_PASSWORD := os.Getenv("DB_PASSWORD")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=%s", DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, TZ)
	log.Println("dsn:", dsn)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
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

func scan(scraper *twitterscraper.Scraper, tweetQuery string) {
	for tweet := range scraper.SearchTweets(context.Background(), tweetQuery, 10) {
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

func getScraper(tweetUserName string, tweetPassword string, tweetCodeFor2fa string) *twitterscraper.Scraper {
	cookiePath := fmt.Sprintf(".cookies%clogin_cookie_%s_%s", os.PathSeparator, tweetUserName, tweetCodeFor2fa)

	scraper := twitterscraper.New()

	fr, err := os.Open(cookiePath)
	if err != nil {
		fmt.Println("tweetUserName:", tweetUserName)
		fmt.Println("tweetPassword:", tweetPassword)
		fmt.Println("tweetCodeFor2fa:", tweetCodeFor2fa)
		err := scraper.Login(tweetUserName, tweetPassword, tweetCodeFor2fa)
		if err != nil {
			log.Fatal("Twitter login failed:", err.Error())
		}

		cookies := scraper.GetCookies()
		content, _ := json.Marshal(cookies)
		fw, _ := os.Create(cookiePath)
		fw.Write(content)

		return scraper
	}

	var cookies []*http.Cookie
	json.NewDecoder(fr).Decode(&cookies)
	scraper.SetCookies(cookies)

	if !scraper.IsLoggedIn() {
		err := scraper.Login(tweetUserName, tweetPassword, tweetCodeFor2fa)
		if err != nil {
			log.Fatal("Twitter login failed:", err.Error())
		}

		cookies := scraper.GetCookies()
		content, _ := json.Marshal(cookies)
		fw, _ := os.Create(cookiePath)
		fw.Write(content)

		return scraper
	}

	return scraper
}

func tickerScan() {
	tweetUserName := os.Getenv("TWEET_USER_NAME")
	if tweetUserName == "" {
		fmt.Println("Miss env: [TWEET_USER_NAME]")
		return
	}
	tweetPassword := os.Getenv("TWEET_PASSWORD")
	if tweetPassword == "" {
		fmt.Println("Miss env: [TWEET_PASSWORD]")
		return
	}
	tweetCodeFor2fa := os.Getenv("TWEET_CODE_FOR_2FA")
	if tweetCodeFor2fa == "" {
		fmt.Println("Miss env: [TWEET_CODE_FOR_2FA]")
		return
	}
	tweetQuery := os.Getenv("TWEET_QUERY")
	if tweetQuery == "" {
		fmt.Println("Miss env: [TWEET_QUERY]")
		return
	}

	scraper := getScraper(tweetUserName, tweetPassword, tweetCodeFor2fa)
	scraper.SetSearchMode(twitterscraper.SearchLatest)

	var scanTotal int64
	for {
		log.Println("scanTotal:", scanTotal)

		scan(scraper, tweetQuery)
		time.Sleep(time.Second * 10)

		scanTotal += 1
	}
}

func main() {
	godotenv.Load(fmt.Sprintf("..%c.env", os.PathSeparator))

	core.db = connectDB()

	tickerScan()
}
