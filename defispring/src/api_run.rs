use actix_web::{middleware, App, HttpServer};
use defispring::api::{
    data_storage::update_api_data,
    endpoints::{get_allocation_amount, get_calldata, get_root, ApiDoc},
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    update_api_data();

    let openapi = ApiDoc::openapi();

    println!("API ready");

    HttpServer::new(move || {
        App::new()
            .wrap(middleware::DefaultHeaders::new().add(("Access-Control-Allow-Origin", "*")))
            .service(get_calldata)
            .service(get_allocation_amount)
            .service(get_root)
            .service(
                SwaggerUi::new("/swagger-ui/{_:.*}").url("/api-docs/openapi.json", openapi.clone()),
            )
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
